import { Bot } from 'grammy';

const bot = new Bot('9148283226:AAFCIHcv9OuVzaBMfC1Is1Uptd473SdofzM');

// دستور شروع ربات
bot.command('start', async (ctx) => {
    await ctx.reply('سلام! خوش آمدید. 🥗\nبرای ثبت درخواست رژیم غذایی، لطفاً سن خود را ارسال کنید:');
});

// دریافت پیام و سن کاربر
bot.on('message:text', async (ctx) => {
    const age = ctx.message.text;
    await ctx.reply(`✅ درخواست رژیم شما ثبت شد!\nسن ثبت‌شده: ${age}\nبه زودی برنامه شما آماده می‌شود.`);
});

// استفاده از روش Polling برای اجرا روی Render
bot.start();
console.log('ربات در حال اجراست...');
