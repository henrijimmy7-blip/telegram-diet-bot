const { Bot } = require('grammy');
const http = require('http');

const BOT_TOKEN = '9016404137:AAEj85yDR8ax_WSJTccSKjpFr9FnXk8bsv8';
const ADMIN_CHAT_ID = 7279065642; // آیدی عددی شما

const bot = new Bot(BOT_TOKEN);

// دستور شروع برای کاربران
bot.command('start', async (ctx) => {
    await ctx.reply('سلام! خوش آمدید. 🥗\nلطفاً سن، وزن و هدف خود از رژیم غذایی را بنویسید و ارسال کنید تا برای متخصص ارسال شود:');
});

// مدیریت پیام‌ها
bot.on('message:text', async (ctx) => {
    const userId = ctx.from.id;
    const userName = ctx.from.first_name || 'کاربر';
    const text = ctx.message.text;

    // اگر پیام از طرف خودِ شما (مالک ربات) ارسال شده باشد
    if (userId === ADMIN_CHAT_ID) {
        if (ctx.message.reply_to_message) {
            const replyText = ctx.message.reply_to_message.text;
            const match = replyText && replyText.match(/ID:\s*(\d+)/);
            
            if (match && match[1]) {
                const targetUserId = match[1];
                try {
                    await bot.api.sendMessage(targetUserId, `🥗 **پاسخ رژیم غذایی شما از طرف متخصص:**\n\n${text}`);
                    await ctx.reply('✅ رژیم با موفقیت برای کاربر ارسال شد.');
                } catch (err) {
                    await ctx.reply('❌ خطا در ارسال پیام به کاربر.');
                }
                return;
            }
        }
        await ctx.reply('⚠️ برای ارسال رژیم، لطفاً روی پیام درخواست کاربر در چت ربات **Reply (پاسخ)** کنید و متن رژیم را بفرستید.');
        return;
    }

    // اگر پیام از طرف کاربر عادی باشد
    await ctx.reply('✅ درخواست شما با موفقیت برای متخصص ارسال شد. به زودی برنامه رژیم خود را دریافت خواهید کرد.');

    // ارسال درخواست به ادمین (شما)
    try {
        await bot.api.sendMessage(
            ADMIN_CHAT_ID,
            `📩 **درخواست جدید رژیم غذایی!**\n\n👤 نام: ${userName}\n🆔 ID: ${userId}\n💬 متن درخواست:\n${text}`,
            { parse_mode: 'Markdown' }
        );
    } catch (err) {
        console.error('خطا در ارسال به ادمین:', err);
    }
});

// روشن کردن ربات
bot.start();
console.log('ربات آماده به کار است...');

// سرور وب برای Render
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running successfully!');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
