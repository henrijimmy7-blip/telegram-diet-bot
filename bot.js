import { Bot } from 'grammy';
import http from 'http';

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

// روشن کردن ربات با روش Polling
bot.start();
console.log('ربات تلگرام روشن شد...');

// ساخت یک سرور HTTP ساده برای اینکه Render ارور ندهد
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running successfully!');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
