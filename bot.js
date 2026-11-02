const { Bot, InlineKeyboard, InputFile } = require('grammy');
const express = require('express');
const multer = require('multer');
const axios = require('axios');

// ================= تنظیمات پایه =================
const BOT_TOKEN = '9016404137:AAEj85yDR8ax_WSJTccSKjpFr9FnXk8bsv8';
const ADMIN_CHAT_ID = 7279065642;
const APP_URL = 'https://telegram-diet-bot-adxs.onrender.com';
const ZARINPAL_MERCHANT_ID = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'; // در صورت فعال‌سازی مرچنت زرین‌پال

const bot = new Bot(BOT_TOKEN);
const app = express();
app.use(express.json());

// حافظه موقت برای آپلود عکس روی سرور Render
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 } // تا ۸ مگابایت
});

// دیتابیس در حافظه موقت سرور
let usersSubmissions = [];
let assignedPlans = {};

// تابع کمکی برای فرار کاراکترهای خطرناک در HTML تلگرام
function escapeHTML(str = '') {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// ۱. دستور استارت
bot.command('start', async (ctx) => {
    const keyboard = new InlineKeyboard().webApp('⚡ ورود به کلینیک پادین', `${APP_URL}/miniapp`);
    await ctx.reply(
        '👋 <b>سلام و درود به کلینیک تخصصی تناسب اندام و رژیم پادین خوش آمدید.</b>\n\n' +
        'برای ثبت اطلاعات بدنی، ارسال آزمایش‌ها و دریافت برنامه تخصصی خود، دکمه زیر را لمس کنید:',
        { reply_markup: keyboard, parse_mode: 'HTML' }
    );
});

// ۲. ریپلای ادمین در تلگرام به پیام یا تصویر مراجع
bot.on('message:text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;

    if (userId === ADMIN_CHAT_ID && ctx.message.reply_to_message) {
        const replied = ctx.message.reply_to_message;
        const targetText = replied.text || replied.caption || '';
        const match = targetText.match(/(?:Client_ID|شناسه):\s*`?(\d+)`?/i);
        
        if (match && match[1]) {
            const targetUserId = match[1];
            if (!assignedPlans[targetUserId]) assignedPlans[targetUserId] = {};
            assignedPlans[targetUserId].diet = text;

            try {
                await bot.api.sendMessage(
                    targetUserId,
                    `🌟 <b>دستورات جدید برنامه شما از طرف متخصص صادر شد:</b>\n\n${escapeHTML(text)}`,
                    { parse_mode: 'HTML' }
                );
                await ctx.reply('✅ برنامه با موفقیت و فرمت امن برای کاربر ارسال شد.');
            } catch (err) {
                await ctx.reply('❌ خطا در ارسال پیام به کاربر (ممکن است ربات را متوقف کرده باشد).');
            }
        }
    }
});

// ۳. دریافت پرونده و تصویر آزمایش از مینی‌اپ
app.post('/api/submit-diet', upload.single('medicalDoc'), async (req, res) => {
    try {
        const { userId, userName, goal, age, gender, height, weight, activity, allergies } = req.body;
        const file = req.file;

        if (!userId) {
            return res.status(400).json({ success: false, message: 'شناسه کاربر یافت نشد' });
        }

        const userData = { 
            userId, 
            userName: userName || 'کاربر پادین', 
            goal, 
            age, 
            gender, 
            height, 
            weight, 
            activity, 
            allergies, 
            hasDoc: !!file,
            date: new Date().toLocaleDateString('fa-IR') 
        };

        const existingIndex = usersSubmissions.findIndex(u => String(u.userId) === String(userId));
        if (existingIndex >= 0) {
            usersSubmissions[existingIndex] = userData;
        } else {
            usersSubmissions.push(userData);
        }

        const report = 
            `📩 <b>پرونده جدید مراجع در سامانه پادین</b>\n\n` +
            `👤 نام: <b>${escapeHTML(userData.userName)}</b>\n` +
            `🆔 Client_ID: <code>${userId}</code>\n` +
            `🎯 هدف: <b>${escapeHTML(goal)}</b>\n` +
            `📅 سن: ${age} سال | 🚻 جنسیت: ${gender}\n` +
            `📏 قد: ${height} cm | ⚖️ وزن: ${weight} kg\n` +
            `🏃‍♂️ سطح فعالیت: ${activity}\n` +
            `⚠️ آسیب/آلرژی: <b>${escapeHTML(allergies || 'ندارد')}</b>\n` +
            `📎 آزمایش/فایل پیوست: ${file ? '✅ دارد (تصویر الصاق شد)' : '❌ مدرکی ضمیمه نشده'}`;

        if (file) {
            await bot.api.sendPhoto(ADMIN_CHAT_ID, new InputFile(file.buffer, file.originalname), {
                caption: report,
                parse_mode: 'HTML'
            });
        } else {
            await bot.api.sendMessage(ADMIN_CHAT_ID, report, { parse_mode: 'HTML' });
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Submit Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ۴. ایجاد تراکنش پرداخت زرین‌پال
app.post('/api/create-payment', async (req, res) => {
    try {
        const { userId, amount, description } = req.body;
        
        if (ZARINPAL_MERCHANT_ID.includes('xxxx')) {
            return res.status(400).json({ 
                success: false, 
                message: 'مرچنت درگاه تعریف نشده است. جهت پرداخت کارت‌به‌کارت اقدام فرمایید.' 
            });
        }

        const response = await axios.post('https://payment.zarinpal.com/pg/v4/payment/request.json', {
            merchant_id: ZARINPAL_MERCHANT_ID,
            amount: Number(amount) * 10,
            description: description || 'پرداخت ویزیت و رژیم پادین',
            callback_url: `${APP_URL}/api/verify-payment?userId=${userId}&amount=${amount}`
        });

        if (response.data?.data?.code === 100) {
            const authority = response.data.data.authority;
            return res.json({ success: true, paymentUrl: `https://payment.zarinpal.com/pg/StartPay/${authority}` });
        }
        res.status(400).json({ success: false, message: 'خطا در صدور درگاه' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// وریفای بازگشت از پرداخت
app.get('/api/verify-payment', async (req, res) => {
    const { Authority, Status, userId, amount } = req.query;
    if (Status !== 'OK') {
        return res.send(`
            <body style="font-family:sans-serif; text-align:center; padding:50px; background:#0b0f19; color:#f87171;">
                <h2>❌ پرداخت انجام نشد</h2>
                <p>تراکنش توسط کاربر لغو گردید یا با خطا مواجه شد. لطفاً به ربات تلگرام بازگردید.</p>
            </body>
        `);
    }

    try {
        const verifyRes = await axios.post('https://payment.zarinpal.com/pg/v4/payment/verify.json', {
            merchant_id: ZARINPAL_MERCHANT_ID,
            amount: Number(amount) * 10,
            authority: Authority
        });

        const code = verifyRes.data?.data?.code;
        const refId = verifyRes.data?.data?.ref_id;

        if (code === 100 || code === 101) {
            await bot.api.sendMessage(
                userId,
                `✅ <b>پرداخت شما با موفقیت تایید شد!</b>\n\nکد رهگیری: <code>${refId}</code>\nپرونده شما در اولویت آنالیز متخصص قرار گرفت.`,
                { parse_mode: 'HTML' }
            );
            await bot.api.sendMessage(
                ADMIN_CHAT_ID,
                `💰 <b>تراکنش تایید شده جدید</b>\nکاربر: <code>${userId}</code>\nمبلغ: ${amount} تومان\nشماره پیگیری: <code>${refId}</code>`,
                { parse_mode: 'HTML' }
            );

            return res.send(`
                <body style="font-family:sans-serif; text-align:center; padding:50px; background:#0b0f19; color:#34d399;">
                    <h2>✅ پرداخت با موفقیت ثبت شد</h2>
                    <p style="color:#94a3b8;">کد پیگیری تراکنش: <b>${refId}</b></p>
                    <p>می‌توانید این صفحه را ببندید و در تلگرام برنامه خود را دنبال کنید.</p>
                </body>
            `);
        }
        res.send('کد اعتبارسنجی تایید نشد.');
    } catch (e) {
        res.send('خطای اتصال به درگاه.');
    }
});

// ۵. صدور برنامه توسط ادمین از پنل
app.post('/api/admin-assign-plan', async (req, res) => {
    try {
        const { adminId, targetUserId, dietPlan, workoutPlan } = req.body;
        if (Number(adminId) !== ADMIN_CHAT_ID) {
            return res.status(403).json({ success: false, message: 'عدم دسترسی مجاز' });
        }

        assignedPlans[targetUserId] = { diet: dietPlan, workout: workoutPlan };

        await bot.api.sendMessage(
            targetUserId, 
            `🎉 <b>برنامه جدید شما ثبت شد!</b>\n\n` +
            `🥗 <b>برنامه تغذیه:</b>\n${escapeHTML(dietPlan) || '—'}\n\n` +
            `🏋️‍♂️ <b>برنامه ورزشی:</b>\n${escapeHTML(workoutPlan) || '—'}\n\n` +
            `<i>می‌توانید برنامه را با جزئیات کامل در مینی‌اپ در بخش «برنامه من» نیز مرور کنید.</i>`,
            { parse_mode: 'HTML' }
        );

        res.status(200).json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ۶. اندپوینت‌های دریافت اطلاعات
app.get('/api/admin-users', (req, res) => {
    res.json({ users: usersSubmissions, plans: assignedPlans });
});

app.get('/api/get-user-plan/:userId', (req, res) => {
    const userId = req.params.userId;
    res.json(assignedPlans[userId] || { notFound: true });
});

// ۷. ساختار مینی‌اپلیکیشن (طراحی لوکس، سبک، به همراه Haptic Feedback)
app.get('/miniapp', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
        <title>کلینیک پادین</title>
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
            :root {
                --bg: #07090e;
                --surface: rgba(18, 24, 38, 0.72);
                --surface-solid: #111726;
                --surface-card: rgba(30, 41, 67, 0.45);
                --border: rgba(255, 255, 255, 0.08);
                --border-focus: #6366f1;
                --text-main: #f8fafc;
                --text-muted: #94a3b8;
                --primary: #6366f1;
                --primary-gradient: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
                --emerald-gradient: linear-gradient(135deg, #059669 0%, #10b981 100%);
                --glow: 0 0 25px rgba(99, 102, 241, 0.28);
            }

            * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
                -webkit-tap-highlight-color: transparent;
                user-select: none;
            }

            body {
                font-family: 'Vazirmatn', -apple-system, sans-serif;
                background-color: var(--bg);
                background-image: 
                    radial-gradient(circle at 10% 0%, rgba(99, 102, 241, 0.22), transparent 40%),
                    radial-gradient(circle at 90% 90%, rgba(16, 185, 129, 0.15), transparent 45%);
                background-attachment: fixed;
                color: var(--text-main);
                padding: 14px 14px 105px 14px;
                min-height: 100vh;
                overflow-x: hidden;
            }

            /* هدر لوکس بالا */
            .header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 6px 4px 18px 4px;
            }
            .brand-title {
                font-size: 21px;
                font-weight: 900;
                background: var(--primary-gradient);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                letter-spacing: -0.5px;
            }
            .brand-sub {
                font-size: 11.5px;
                color: var(--text-muted);
                font-weight: 500;
                margin-top: 2px;
            }
            .status-pill {
                display: flex;
                align-items: center;
                gap: 5px;
                background: rgba(16, 185, 129, 0.12);
                border: 1px solid rgba(16, 185, 129, 0.25);
                color: #34d399;
                padding: 5px 12px;
                border-radius: 99px;
                font-size: 11.5px;
                font-weight: 600;
            }
            .status-dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: #10b981;
                box-shadow: 0 0 8px #10b981;
            }

            /* نوار تب شناور نئونی در پایین */
            .bottom-bar {
                position: fixed;
                bottom: 16px;
                left: 14px;
                right: 14px;
                background: rgba(13, 18, 30, 0.88);
                backdrop-filter: blur(24px);
                -webkit-backdrop-filter: blur(24px);
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 26px;
                display: flex;
                padding: 5px;
                gap: 4px;
                z-index: 1000;
                box-shadow: 0 16px 36px rgba(0, 0, 0, 0.65);
            }
            .nav-btn {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 8px 0;
                background: transparent;
                border: none;
                color: var(--text-muted);
                border-radius: 20px;
                cursor: pointer;
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                font-family: inherit;
            }
            .nav-btn .icon {
                font-size: 20px;
                line-height: 1;
                margin-bottom: 3px;
                transition: transform 0.2s ease;
            }
            .nav-btn .txt {
                font-size: 11px;
                font-weight: 600;
            }
            .nav-btn.active {
                background: var(--primary-gradient);
                color: #ffffff;
                box-shadow: var(--glow);
            }
            .nav-btn.active .icon {
                transform: scale(1.15);
            }

            /* انیمیشن سوییچ تب‌ها */
            .view-pane {
                display: none;
            }
            .view-pane.active {
                display: block;
                animation: smoothFade 0.28s cubic-bezier(0.16, 1, 0.3, 1);
            }
            @keyframes smoothFade {
                from { opacity: 0; transform: translateY(8px); }
                to { opacity: 1; transform: translateY(0); }
            }

            /* کارت‌های شیشه‌ای */
            .glass-card {
                background: var(--surface);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid var(--border);
                border-radius: 22px;
                padding: 18px;
                margin-bottom: 14px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            }
            .card-title-box {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 14px;
            }
            .card-head {
                font-size: 15px;
                font-weight: 800;
                color: #e2e8f0;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .badge-tag {
                font-size: 10.5px;
                font-weight: 600;
                padding: 4px 9px;
                border-radius: 10px;
                background: rgba(255, 255, 255, 0.06);
                color: var(--text-muted);
            }

            /* اسکرول افقی روزها */
            .days-track {
                display: flex;
                gap: 7px;
                overflow-x: auto;
                padding: 2px 2px 12px 2px;
                margin-bottom: 12px;
                scrollbar-width: none;
            }
            .days-track::-webkit-scrollbar { display: none; }
            .day-chip {
                padding: 8px 16px;
                background: var(--surface-card);
                border: 1px solid var(--border);
                border-radius: 16px;
                color: var(--text-muted);
                font-size: 12px;
                font-weight: 600;
                white-space: nowrap;
                cursor: pointer;
                transition: all 0.2s ease;
                font-family: inherit;
            }
            .day-chip.active {
                background: #ffffff;
                color: #07090e;
                border-color: #ffffff;
                box-shadow: 0 4px 15px rgba(255, 255, 255, 0.2);
                font-weight: 800;
            }

            /* فرم‌ها */
            .form-grid-2 {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
            }
            .field-group {
                margin-bottom: 12px;
            }
            label {
                display: block;
                font-size: 11.5px;
                font-weight: 700;
                color: var(--text-muted);
                margin-bottom: 6px;
            }
            input, select, textarea {
                width: 100%;
                padding: 12px 14px;
                background: rgba(11, 16, 27, 0.65);
                border: 1px solid var(--border);
                border-radius: 14px;
                color: var(--text-main);
                font-size: 13px;
                font-family: inherit;
                outline: none;
                transition: all 0.2s ease;
            }
            input:focus, select:focus, textarea:focus {
                border-color: var(--border-focus);
                background: rgba(11, 16, 27, 0.95);
                box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
            }
            textarea { resize: vertical; min-height: 75px; }

            /* باکس مدرن آپلود تصویر آزمایش */
            .file-picker-card {
                border: 1.5px dashed rgba(99, 102, 241, 0.35);
                background: rgba(99, 102, 241, 0.04);
                border-radius: 18px;
                padding: 14px;
                text-align: center;
                cursor: pointer;
                position: relative;
                transition: all 0.2s ease;
            }
            .file-picker-card:hover {
                border-color: var(--primary);
                background: rgba(99, 102, 241, 0.08);
            }
            .file-preview-box {
                display: none;
                align-items: center;
                justify-content: space-between;
                background: rgba(15, 23, 42, 0.8);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 12px;
                padding: 8px 12px;
                margin-top: 8px;
            }

            /* دکمه اکشن بزرگ */
            .action-btn {
                width: 100%;
                padding: 14px;
                background: var(--primary-gradient);
                color: #ffffff;
                border: none;
                border-radius: 16px;
                font-size: 14px;
                font-weight: 800;
                cursor: pointer;
                box-shadow: var(--glow);
                transition: transform 0.15s ease;
                font-family: inherit;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
            }
            .action-btn:active {
                transform: scale(0.97);
            }

            /* کارت‌های وعده و تمرین */
            .routine-item {
                background: rgba(11, 16, 27, 0.55);
                border: 1px solid var(--border);
                border-radius: 16px;
                padding: 14px;
                margin-bottom: 10px;
                transition: border-color 0.2s ease;
            }
            .routine-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 6px;
            }
            .routine-title {
                font-size: 14px;
                font-weight: 800;
                color: #c7d2fe;
            }
            .routine-desc {
                font-size: 12.5px;
                color: var(--text-muted);
                line-height: 1.7;
            }

            /* استایل مراجعات ادمین */
            .admin-client-card {
                background: rgba(13, 18, 30, 0.75);
                border: 1px solid var(--border);
                border-radius: 18px;
                padding: 16px;
                margin-bottom: 14px;
            }
        </style>
    </head>
    <body>

        <!-- هدر اصلی -->
        <header class="header">
            <div>
                <h1 class="brand-title" id="top-title">کلینیک پادین</h1>
                <p class="brand-sub" id="top-sub">سامانه هوشمند سلامت و رژیم‌درمانی</p>
            </div>
            <div class="status-pill">
                <span class="status-dot"></span>
                <span id="role-tag">آنلاین</span>
            </div>
        </header>

        <!-- پنل ادمین -->
        <div id="admin-view" style="display: none;">
            <div class="glass-card">
                <div class="card-title-box">
                    <span class="card-head">🛡️ مراجعین و صدور برنامه</span>
                    <span class="badge-tag">داشبورد پزشک</span>
                </div>
                <div id="admin-list-container">در حال بارگذاری لیست بیماران...</div>
            </div>
        </div>

        <!-- پنل کاربری -->
        <div id="user-view">

            <!-- تب ۱: وضعیت برنامه من -->
            <div id="myplan-tab" class="view-pane active">
                <div class="glass-card">
                    <div class="card-title-box">
                        <span class="card-head">🌟 برنامه اختصاصی شما</span>
                        <span class="badge-tag">پرونده پزشکی</span>
                    </div>
                    <div id="user-plan-status">در حال دریافت وضعیت از سرور...</div>
                </div>
            </div>

            <!-- تب ۲: پیشنهادهای تغذیه -->
            <div id="diet-tab" class="view-pane">
                <div class="days-track">
                    <button class="day-chip active" onclick="switchDietDay('saturday', this)">شنبه</button>
                    <button class="day-chip" onclick="switchDietDay('sunday', this)">یکشنبه</button>
                    <button class="day-chip" onclick="switchDietDay('monday', this)">دوشنبه</button>
                    <button class="day-chip" onclick="switchDietDay('tuesday', this)">سه‌شنبه</button>
                    <button class="day-chip" onclick="switchDietDay('wednesday', this)">چهارشنبه</button>
                    <button class="day-chip" onclick="switchDietDay('thursday', this)">پنجشنبه</button>
                    <button class="day-chip" onclick="switchDietDay('friday', this)">جمعه</button>
                </div>
                <div id="diet-cards-wrapper"></div>
            </div>

            <!-- تب ۳: پروتکل‌های ورزشی -->
            <div id="workout-tab" class="view-pane">
                <div class="days-track">
                    <button class="day-chip active" onclick="switchWorkoutDay('w_sat', this)">شنبه</button>
                    <button class="day-chip" onclick="switchWorkoutDay('w_sun', this)">یکشنبه</button>
                    <button class="day-chip" onclick="switchWorkoutDay('w_mon', this)">دوشنبه</button>
                    <button class="day-chip" onclick="switchWorkoutDay('w_tue', this)">سه‌شنبه</button>
                    <button class="day-chip" onclick="switchWorkoutDay('w_wed', this)">چهارشنبه</button>
                    <button class="day-chip" onclick="switchWorkoutDay('w_thu', this)">پنجشنبه</button>
                    <button class="day-chip" onclick="switchWorkoutDay('w_fri', this)">جمعه</button>
                </div>
                <div id="workout-cards-wrapper"></div>
            </div>

            <!-- تب ۴: پرونده و فرم -->
            <div id="profile-tab" class="view-pane">
                <div class="glass-card">
                    <div class="card-title-box">
                        <span class="card-head">📋 فرم آنالیز سلامت بدنی</span>
                        <span class="badge-tag">محرمانه</span>
                    </div>

                    <form id="dietForm">
                        <div class="field-group">
                            <label>🎯 هدف اصلی دوره:</label>
                            <select id="goal" required>
                                <option value="کاهش وزن و چربی‌سوزی">📉 کاهش وزن و چربی‌سوزی</option>
                                <option value="افزایش حجم عضلانی">📈 افزایش حجم و عضله‌سازی</option>
                                <option value="تثبیت و اصلاح الگوی بدنی">⚖️ تثبیت وزن و فرم‌دهی</option>
                            </select>
                        </div>

                        <div class="form-grid-2">
                            <div class="field-group">
                                <label>📅 سن:</label>
                                <input type="number" id="age" placeholder="مثلاً ۲۶" required>
                            </div>
                            <div class="field-group">
                                <label>🚻 جنسیت:</label>
                                <select id="gender" required>
                                    <option value="زن">خانم</option>
                                    <option value="مرد">آقا</option>
                                </select>
                            </div>
                            <div class="field-group">
                                <label>📏 قد (cm):</label>
                                <input type="number" id="height" placeholder="مثلاً ۱۷۸" required>
                            </div>
                            <div class="field-group">
                                <label>⚖️ وزن (kg):</label>
                                <input type="number" id="weight" placeholder="مثلاً ۷۴" required>
                            </div>
                        </div>

                        <div class="field-group">
                            <label>🏃‍♂️ سطح فعالیت هفتگی:</label>
                            <select id="activity" required>
                                <option value="کم‌تحرک">کم‌تحرک (پشت‌میزی / بدون ورزش)</option>
                                <option value="متوسط">متوسط (ورزش هوازی یا بدنسازی ۲-۳ روز)</option>
                                <option value="پرتحرک">پرتحرک (ورزش سنگین یا فعالیت مداوم)</option>
                            </select>
                        </div>

                        <div class="field-group">
                            <label>⚠️ بیماری، آسیب اسکلتی یا حساسیت غذایی:</label>
                            <textarea id="allergies" placeholder="مثلاً دیسک کمر، زانودرد، کبد چرب، حساسیت به گلوتن..."></textarea>
                        </div>

                        <!-- باکس آپلود تصویر آزمایش -->
                        <div class="field-group">
                            <label>📎 تصویر برگه آزمایش یا چکاپ (اختیاری):</label>
                            <div class="file-picker-card" onclick="document.getElementById('medicalDoc').click()">
                                <div style="font-size: 24px; margin-bottom: 4px;">📸</div>
                                <div style="font-size: 12px; font-weight: 700; color: #a5b4fc;">لمس جهت انتخاب تصویر آزمایش یا سونوگرافی</div>
                                <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 2px;">فرمت‌های مجاز: JPG, PNG (حداکثر ۸ مگابایت)</div>
                                <input type="file" id="medicalDoc" accept="image/*" style="display:none;" onchange="handleFileSelect(this)">
                            </div>
                            <div id="file-preview-card" class="file-preview-box">
                                <span id="file-name-text" style="font-size: 11.5px; color: #34d399;"></span>
                                <button type="button" onclick="clearSelectedFile()" style="background:none; border:none; color:#f87171; font-size:12px; cursor:pointer;">❌ حذف</button>
                            </div>
                        </div>

                        <button type="submit" class="action-btn" id="submit-btn" style="margin-top: 10px;">
                            <span>ثبت پرونده و ارسال به متخصص</span>
                            <span>←</span>
                        </button>
                    </form>

                    <!-- درگاه پرداخت آنلاین -->
                    <div style="margin-top: 18px; border-top: 1px dashed var(--border); padding-top: 16px; text-align: center;">
                        <p style="font-size: 12.5px; color: var(--text-muted); margin-bottom: 10px;">هزینه ویزیت و تنظیم برنامه کامل دوره: <b>۲۵۰,۰۰۰ تومان</b></p>
                        <button type="button" class="action-btn" style="background: var(--emerald-gradient);" onclick="triggerPayment(250000)">
                            💳 پرداخت مستقیم با زرین‌پال
                        </button>
                    </div>
                </div>
            </div>

            <!-- منوی شناور پایین صفحه با حس لمسی بومی -->
            <nav class="bottom-bar">
                <button class="nav-btn active" onclick="navigate('myplan', this)">
                    <span class="icon">🌟</span>
                    <span class="txt">برنامه من</span>
                </button>
                <button class="nav-btn" onclick="navigate('diet', this)">
                    <span class="icon">🥗</span>
                    <span class="txt">تغذیه</span>
                </button>
                <button class="nav-btn" onclick="navigate('workout', this)">
                    <span class="icon">🏋️‍♂️</span>
                    <span class="txt">ورزش</span>
                </button>
                <button class="nav-btn" onclick="navigate('profile', this)">
                    <span class="icon">👤</span>
                    <span class="txt">پرونده</span>
                </button>
            </nav>
        </div>

        <script>
            const tg = window.Telegram?.WebApp;
            if (tg) {
                tg.expand();
                tg.ready();
            }

            // فیدبک لمسی Haptic تلگرام
            function haptic(type = 'light') {
                try {
                    if (tg?.HapticFeedback) {
                        if (type === 'light') tg.HapticFeedback.impactOccurred('light');
                        if (type === 'success') tg.HapticFeedback.notificationOccurred('success');
                        if (type === 'error') tg.HapticFeedback.notificationOccurred('error');
                    }
                } catch(e) {}
            }

            // شناسایی کاربر واقعی بدون باگ امنیتی ادمین
            const currentUser = tg?.initDataUnsafe?.user || { id: 100001, first_name: 'کاربر مهمان' };
            const ADMIN_ID = 7279065642;

            if (Number(currentUser.id) === Number(ADMIN_ID)) {
                document.getElementById('admin-view').style.display = 'block';
                document.getElementById('user-view').style.display = 'none';
                document.getElementById('top-title').innerText = 'داشبورد پزشک (پادین)';
                document.getElementById('top-sub').innerText = 'پنل مراجعین و صدور رژیم غذایی';
                document.getElementById('role-tag').innerText = 'مدیر ارشد';
                loadAdminList();
            } else {
                loadUserProgram();
            }

            // ناوبری بین تب‌ها با ویبره لطیف و سرعت آنی
            function navigate(tabId, el) {
                haptic('light');
                document.querySelectorAll('.view-pane').forEach(p => p.classList.remove('active'));
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                
                const target = document.getElementById(tabId + '-tab');
                if (target) target.classList.add('active');
                if (el) el.classList.add('active');
            }

            // لود وضعیت برنامه کاربر
            async function loadUserProgram() {
                const box = document.getElementById('user-plan-status');
                try {
                    const res = await fetch(\`/api/get-user-plan/\${currentUser.id}\`);
                    const data = await res.json();

                    if (data.notFound || (!data.diet && !data.workout)) {
                        box.innerHTML = \`
                            <div style="text-align: center; padding: 22px 10px;">
                                <div style="font-size: 38px; margin-bottom: 8px;">⏳</div>
                                <div style="font-weight: 800; font-size: 14px; margin-bottom: 4px;">برنامه‌ای صادر نشده است</div>
                                <p style="font-size: 12px; color: var(--text-muted); line-height: 1.6;">
                                    لطفاً از تب «پرونده» فرم مشخصات را تکمیل و ارسال فرمایید تا متخصص برنامه شما را تدوین کند.
                                </p>
                            </div>
                        \`;
                    } else {
                        box.innerHTML = \`
                            <div style="background: rgba(11, 16, 27, 0.7); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 16px; padding: 14px; margin-bottom: 10px;">
                                <div style="color: #818cf8; font-weight: 800; font-size: 13.5px; margin-bottom: 6px;">🥗 برنامه تغذیه شما:</div>
                                <div style="font-size: 13px; line-height: 1.8; white-space: pre-line;">\${data.diet || 'ثبت نشده'}</div>
                            </div>
                            <div style="background: rgba(11, 16, 27, 0.7); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 16px; padding: 14px;">
                                <div style="color: #34d399; font-weight: 800; font-size: 13.5px; margin-bottom: 6px;">🏋️‍♂️ برنامه تمرین ورزشی:</div>
                                <div style="font-size: 13px; line-height: 1.8; white-space: pre-line;">\${data.workout || 'ثبت نشده'}</div>
                            </div>
                        \`;
                    }
                } catch(e) {
                    box.innerHTML = '<p style="color:#f87171; font-size:12px;">خطا در برقراری ارتباط با سرور.</p>';
                }
            }

            // لود لیست مراجعین در پنل ادمین
            async function loadAdminList() {
                const list = document.getElementById('admin-list-container');
                try {
                    const res = await fetch('/api/admin-users');
                    const data = await res.json();

                    if (!data.users || data.users.length === 0) {
                        list.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">هیچ پرونده‌ای تا این لحظه ثبت نشده است.</p>';
                        return;
                    }

                    list.innerHTML = data.users.map(u => \`
                        <div class="admin-client-card">
                            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                                <strong style="font-size:14px; color:#a5b4fc;">👤 \${u.userName}</strong>
                                <span class="badge-tag">\${u.date}</span>
                            </div>
                            <div style="font-size:12px; color:var(--text-muted); line-height:1.7;">
                                <span>شناسه تلگرام: <code style="color:#e2e8f0;">\${u.userId}</code></span><br>
                                <span>🎯 هدف: <b style="color:#fff;">\${u.goal}</b> | سن: \${u.age} سال | جنسیت: \${u.gender}</span><br>
                                <span>قد: \${u.height} سم | وزن: \${u.weight} کیلو | فعالیت: \${u.activity}</span><br>
                                <span style="color:#fb7185;">محدودیت/آلرژی: \${u.allergies || 'ندارد'}</span><br>
                                <span style="color:\${u.hasDoc ? '#34d399' : '#94a3b8'};">وضعیت مدرک پزشکی: \${u.hasDoc ? '✅ تصویر دارد' : '❌ بدون تصویر'}</span>
                            </div>
                            <div style="margin-top:12px; border-top:1px solid var(--border); padding-top:10px;">
                                <label style="color:#818cf8;">دستورات رژیم غذایی:</label>
                                <textarea id="diet_\${u.userId}" placeholder="برنامه غذایی اختصاصی..."></textarea>
                                
                                <label style="color:#34d399; margin-top:8px;">دستورات تمرینات ورزشی:</label>
                                <textarea id="workout_\${u.userId}" placeholder="برنامه تمرینی اختصاصی..."></textarea>
                                
                                <button class="action-btn" style="margin-top:10px; padding:10px; font-size:13px;" onclick="assignUserPlan(\${u.userId})">
                                    ارسال آنی برنامه به تلگرام کاربر
                                </button>
                            </div>
                        </div>
                    \`).join('');
                } catch(e) {
                    list.innerHTML = '<p style="color:#f87171;">خطا در دریافت لیست مراجعین.</p>';
                }
            }

            async function assignUserPlan(targetId) {
                haptic('light');
                const dietPlan = document.getElementById(\`diet_\${targetId}\`).value;
                const workoutPlan = document.getElementById(\`workout_\${targetId}\`).value;

                if (!dietPlan && !workoutPlan) {
                    alert('لطفاً حداقل یکی از فیلدهای رژیم یا ورزش را بنویسید.');
                    return;
                }

                try {
                    const res = await fetch('/api/admin-assign-plan', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ adminId: currentUser.id, targetUserId: targetId, dietPlan, workoutPlan })
                    });
                    if (res.ok) {
                        haptic('success');
                        alert('برنامه با موفقیت برای کاربر ارسال شد.');
                        loadAdminList();
                    } else {
                        haptic('error');
                        alert('خطا در ثبت و ارسال برنامه.');
                    }
                } catch(e) {
                    alert('خطای اتصال به سرور.');
                }
            }

            // دیتای تغذیه
            const dietData = {
                saturday: [
                    { title: "🌅 صبحانه پرپروتئین", desc: "۲ عدد تخم‌مرغ آب‌پز + ۳۰ گرم پنیر کم‌چرب + نان جو سبوس‌دار + خیار و گوجه" },
                    { title: "🥗 ناهار تعادلی", desc: "۱۶۰ گرم فیله مرغ گریل شده + ۵ قاشق برنج قهوه‌ای کته + سالاد فصل با روغن زیتون بکر" },
                    { title: "🌙 شام سبک", desc: "خوراک سبزیجات بخارپز (کلم بروکلی، قارچ، هویج) + یک پیاله ماست یونانی کم‌چرب" }
                ],
                sunday: [
                    { title: "🌅 صبحانه انرژی‌بخش", desc: "جو دوسر پرک پخته با شیر کم‌چرب + ۱ قاشق عسل طبیعی + دانه‌های چیا و دارچین" },
                    { title: "🥗 ناهار فیبردار", desc: "خوراک عدسی غلیظ همراه با لیمو ترش تازه + سبزی خوردن تازه و نان سنگک" },
                    { title: "🌙 شام پروتئینی", desc: "املت سفیده تخم‌مرغ با اسفناج و قارچ تفت داده شده با چند قطره روغن کنجد" }
                ],
                monday: [
                    { title: "🌅 صبحانه سنتی سبک", desc: "املت گوجه‌فرنگی با روغن زیتون + نان سنگک برشته + چای سبز بدون قند" },
                    { title: "🥗 ناهار غنی از امگا۳", desc: "۱۸۰ گرم فیله قزل‌آلا یا سالمون تنوری + پوره کدو تنبل یا سیب‌زمینی کوچک" },
                    { title: "🌙 شام سبک", desc: "سوپ جو کم‌چرب با تکه‌های فیله مرغ ریش‌ریش شده و جعفری تازه" }
                ],
                tuesday: [
                    { title: "🌅 صبحانه شاداب", desc: "ماست یونانی + نصف سیب خرد شده + مغز گردو + دانه کتان" },
                    { title: "🥗 ناهار عضله‌ساز", desc: "استیک گوشت گوساله بدون چربی + هویج و لوبیا سبز بخارپز + سالاد" },
                    { title: "🌙 شام ریکاوری", desc: "سالاد سزار خانگی رژیمی با سینه مرغ پخته و سس ماست و آبلیمو" }
                ],
                wednesday: [
                    { title: "🌅 صبحانه پرکالری مفید", desc: "ارده با شیره انگور یا توت + نان جو سبوس‌دار + چای دارچین" },
                    { title: "🥗 ناهار اصیل رژیمی", desc: "خورشت قیمه با تکه‌های بوقلمون و حداقل روغن + برنج کته" },
                    { title: "🌙 شام ملایم", desc: "پنیر کم‌نمک + گردو + نان تست پروتئینی" }
                ],
                thursday: [
                    { title: "🌅 صبحانه فیتنس", desc: "۳ عدد سفیده تخم‌مرغ + ۱ عدد زرده + قارچ تفت‌داده با نان پروتئینی" },
                    { title: "🥗 ناهار فیله کبابی", desc: "کباب کوبیده فیله مرغ خانگی + گوجه کبابی + سالاد کلم با ماست" },
                    { title: "🌙 شام تصفیه‌کننده", desc: "بشقاب سبزیجات پخته با لیمو ترش و دانه‌های شاهدانه" }
                ],
                friday: [
                    { title: "🌅 صبحانه خانوادگی", desc: "نیمرو با حداقل روغن زیتون + گردو و زیتون بدون نمک + نان تازه" },
                    { title: "🥗 ناهار روز استراحت", desc: "جوجه کباب زعفرانی با لیموترش فراوان + سبزیجات تنوری" },
                    { title: "🌙 شام ریلکسی", desc: "یک لیوان شیر بادام ولرم همراه با ۲ عدد خرما" }
                ]
            };

            // دیتای ورزش
            const workoutData = {
                w_sat: [
                    { title: "💪 بالاتنه (سینه و پشت‌بازو)", desc: "۳ ست پرس سینه دمبل (۱۲ تکرار) + ۳ ست شنا سوئدی تعادلی + ۳ ست پشت بازو دیپ" }
                ],
                w_sun: [
                    { title: "🦵 پایین‌تنه (چهارسر و باسن)", desc: "۴ ست اسکات بدون وزنه یا دمبل (۱۵ تکرار) + ۳ ست لانگز متناوب قدم‌رو" }
                ],
                w_mon: [
                    { title: "🏃‍♂️ تمرین هوازی اینتروال", desc: "۳۵ دقیقه پیاده‌روی سریع روی تردمیل شیب‌دار یا دویدن تناوبی در هوای آزاد" }
                ],
                w_tue: [
                    { title: "🦾 زیربغل و سرشانه", desc: "۳ ست نشر از جانب دمبل + ۳ ست زیربغل اره‌ای دمبل تک دست + پلانک ۳ ست ۴۵ ثانیه" }
                ],
                w_wed: [
                    { title: "🦵 همسترینگ و ساق پا", desc: "۳ ست ددلیفت رومانیایی با دمبل + ۳ ست ساق پا ایستاده با مکث ۲ ثانیه‌ای" }
                ],
                w_thu: [
                    { title: "⚡ تمرین فول‌بادی HIIT", desc: "۲۰ دقیقه مدار چربی‌سوزی انفجاری (ترکیب برپی، پروانه سرعتی و طناب‌زنی)" }
                ],
                w_fri: [
                    { title: "🌿 ریکاوری فعال و یوگا", desc: "حرکات کششی عمیق مفصلی و ۲۰ دقیقه تنفس و پیاده‌روی ریلکس" }
                ]
            };

            function switchDietDay(day, btn) {
                haptic('light');
                document.querySelectorAll('#diet-tab .day-chip').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                
                const meals = dietData[day] || [];
                document.getElementById('diet-cards-wrapper').innerHTML = meals.map(m => \`
                    <div class="routine-item">
                        <div class="routine-header">
                            <span class="routine-title">\${m.title}</span>
                            <span class="badge-tag">پیشنهاد متخصص</span>
                        </div>
                        <p class="routine-desc">\${m.desc}</p>
                    </div>
                \`).join('');
            }

            function switchWorkoutDay(day, btn) {
                haptic('light');
                document.querySelectorAll('#workout-tab .day-chip').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');

                const w = workoutData[day] || [];
                document.getElementById('workout-cards-wrapper').innerHTML = w.map(item => \`
                    <div class="routine-item" style="border-right: 3px solid #10b981;">
                        <div class="routine-header">
                            <span class="routine-title" style="color:#34d399;">\${item.title}</span>
                            <span class="badge-tag">پروتکل روز</span>
                        </div>
                        <p class="routine-desc">\${item.desc}</p>
                    </div>
                \`).join('');
            }

            // لود اولیه روز شنبه
            switchDietDay('saturday', document.querySelector('#diet-tab .day-chip'));
            switchWorkoutDay('w_sat', document.querySelector('#workout-tab .day-chip'));

            // مدیریت انتخاب فایل و پیش‌نمایش
            function handleFileSelect(input) {
                const file = input.files[0];
                if (file) {
                    haptic('light');
                    document.getElementById('file-preview-card').style.display = 'flex';
                    document.getElementById('file-name-text').innerText = '📎 ' + file.name + ' (' + (file.size / (1024*1024)).toFixed(1) + ' MB)';
                }
            }

            function clearSelectedFile() {
                haptic('light');
                document.getElementById('medicalDoc').value = '';
                document.getElementById('file-preview-card').style.display = 'none';
            }

            // ارسال فرم مشخصات به سرور
            document.getElementById('dietForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                haptic('light');
                const btn = document.getElementById('submit-btn');
                btn.disabled = true;
                btn.innerHTML = '<span>در حال آپلود و ارسال پرونده...</span>';

                const fd = new FormData();
                fd.append('userId', currentUser.id);
                fd.append('userName', currentUser.first_name || 'کاربر پادین');
                fd.append('goal', document.getElementById('goal').value);
                fd.append('age', document.getElementById('age').value);
                fd.append('gender', document.getElementById('gender').value);
                fd.append('height', document.getElementById('height').value);
                fd.append('weight', document.getElementById('weight').value);
                fd.append('activity', document.getElementById('activity').value);
                fd.append('allergies', document.getElementById('allergies').value);

                const file = document.getElementById('medicalDoc').files[0];
                if (file) fd.append('medicalDoc', file);

                try {
                    const res = await fetch('/api/submit-diet', { method: 'POST', body: fd });
                    if (res.ok) {
                        haptic('success');
                        if (tg?.showAlert) tg.showAlert('✅ پرونده با موفقیت برای پزشک ارسال شد.');
                        else alert('پرونده با موفقیت ثبت شد.');
                        navigate('myplan', document.querySelector('.bottom-bar .nav-btn'));
                    } else {
                        haptic('error');
                        alert('خطا در ثبت اطلاعات.');
                    }
                } catch(err) {
                    haptic('error');
                    alert('خطای اتصال به سرور.');
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = '<span>ثبت پرونده و ارسال به متخصص</span><span>←</span>';
                }
            });

            // پرداخت آنلاین با زرین‌پال
            async function triggerPayment(amount) {
                haptic('light');
                try {
                    const res = await fetch('/api/create-payment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: currentUser.id, amount })
                    });
                    const data = await res.json();
                    if (data.success && data.paymentUrl) {
                        haptic('success');
                        if (tg?.openLink) tg.openLink(data.paymentUrl);
                        else window.location.href = data.paymentUrl;
                    } else {
                        haptic('error');
                        alert(data.message || 'خطا در صدور درگاه پرداخت.');
                    }
                } catch(e) {
                    haptic('error');
                    alert('عدم برقراری تماس با سرور.');
                }
            }
        </script>
    </body>
    </html>
    `);
});

// راه‌اندازی سرور روی Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);
    bot.start({
        onStart: (botInfo) => {
            console.log(`Bot @${botInfo.username} started successfully with polling!`);
        }
    });
});
