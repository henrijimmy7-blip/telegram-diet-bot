const { Bot, InlineKeyboard } = require('grammy');
const http = require('http');

const BOT_TOKEN = '9016404137:AAEj85yDR8ax_WSJTccSKjpFr9FnXk8bsv8';
const ADMIN_CHAT_ID = 7279065642;

const bot = new Bot(BOT_TOKEN);

// ذخیره موقت اطلاعات کاربران در حال ثبت‌نام
const userStates = {};

// دستور شروع ربات و نمایش دکمه‌های هدف
bot.command('start', async (ctx) => {
    const userId = ctx.from.id;
    userStates[userId] = { step: 'SELECT_GOAL' };

    // دکمه‌های شیشه‌ای برای انتخاب هدف
    const keyboard = new InlineKeyboard()
        .text('📉 کاهش وزن', 'goal_loss')
        .text('📈 افزایش وزن', 'goal_gain');

    await ctx.reply('سلام! خوش آمدید به ربات رژیم غذایی 🥗\nلطفاً هدف خود را انتخاب کنید:', {
        reply_markup: keyboard,
    });
});

// دریافت انتخاب هدف از روی دکمه‌ها
bot.callbackQuery(/^goal_(loss|gain)$/, async (ctx) => {
    const userId = ctx.from.id;
    const goal = ctx.match[1] === 'loss' ? 'کاهش وزن' : 'افزایش وزن';

    if (!userStates[userId]) {
        userStates[userId] = {};
    }
    userStates[userId].goal = goal;
    userStates[userId].step = 'WAITING_FOR_AGE';

    await ctx.answerCallbackQuery();
    await ctx.editMessageText(`✅ هدف شما انتخاب شد: **${goal}**\n\nلطفاً **سن** خود را به عدد وارد کنید:`, {
        parse_mode: 'Markdown'
    });
});

// مدیریت پیام‌های متنی (سوالات مرحله‌ای و پاسخ ادمین)
bot.on('message:text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;
    const userName = ctx.from.first_name || 'کاربر';

    // ۱. اگر پیام از طرف شما (ادمین) بود و روی پیام کاربر Reply کرده بودید
    if (userId === ADMIN_CHAT_ID && ctx.message.reply_to_message) {
        const replyText = ctx.message.reply_to_message.text;
        const match = replyText && replyText.match(/Client_ID:\s*(\d+)/);
        
        if (match && match[1]) {
            const targetUserId = match[1];
            try {
                await bot.api.sendMessage(targetUserId, `🥗 **پاسخ برنامه رژیم شما از طرف متخصص:**\n\n${text}`);
                await ctx.reply('✅ رژیم با موفقیت برای کاربر ارسال شد.');
            } catch (err) {
                await ctx.reply('❌ خطا در ارسال پیام به کاربر.');
            }
            return;
        }
    }

    // ۲. مراحل دریافت اطلاعات رژیم از کاربر عادی
    const currentState = userStates[userId]?.step;

    if (currentState === 'WAITING_FOR_AGE') {
        userStates[userId].age = text;
        userStates[userId].step = 'WAITING_FOR_GENDER';
        await ctx.reply('👤 لطفاً **جنسیت** خود را وارد کنید (مثلاً: زن / مرد):');
        return;
    }

    if (currentState === 'WAITING_FOR_GENDER') {
        userStates[userId].gender = text;
        userStates[userId].step = 'WAITING_FOR_HEIGHT';
        await ctx.reply('📏 لطفاً **قد** خود را به سانتی‌متر وارد کنید (مثلاً: ۱۷۵):');
        return;
    }

    if (currentState === 'WAITING_FOR_HEIGHT') {
        userStates[userId].height = text;
        const data = userStates[userId];

        // ارسال خلاصه اطلاعات به ادمین (شما)
        try {
            await bot.api.sendMessage(
                ADMIN_CHAT_ID,
                `📩 **درخواست جدید رژیم غذایی!**\n\n` +
                `👤 نام: ${userName}\n` +
                `🆔 Client_ID: ${userId}\n` +
                `🎯 هدف: ${data.goal}\n` +
                `📅 سن: ${data.age}\n` +
                `🚻 جنسیت: ${data.gender}\n` +
                `📏 قد: ${data.height} سانتی‌متر`,
                { parse_mode: 'Markdown' }
            );

            await ctx.reply('✅ اطلاعات شما با موفقیت ثبت و برای متخصص ارسال شد. به زودی برنامه رژیم شما آماده خواهد شد.');
        } catch (err) {
            console.error('Error sending to admin:', err);
            await ctx.reply('❌ خطایی در ارسال اطلاعات رخ داد. لطفاً دوباره /start را بزنید.');
        }

        // پاک کردن حافظه موقت کاربر بعد از اتمام فرم
        delete userStates[userId];
        return;
    }

    // اگر کاربر خارج از روند فرم پیامی فرستاد
    await ctx.reply('برای شروع دریافت برنامه رژیم، لطفاً دستور /start را ارسال کنید.');
});

// روشن کردن ربات تلگرام
bot.start();
console.log('ربات رژیم غذایی آماده به کار است...');

// سرور وب داخلی برای پایداری روی Render
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running successfully!');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
