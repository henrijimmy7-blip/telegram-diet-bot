const { Bot, InlineKeyboard, InputFile } = require('grammy');
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ================= تنظیمات پایه =================
const BOT_TOKEN = '9016404137:AAEj85yDR8ax_WSJTccSKjpFr9FnXk8bsv8';
const ADMIN_CHAT_ID = 7279065642;
const APP_URL = 'https://telegram-diet-bot-adxs.onrender.com';
const ZARINPAL_MERCHANT_ID = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';

const DB_FILE = path.join(__dirname, 'database.json');

// سیستم ذخیره‌سازی دائمی
function loadDB() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], plans: {} }, null, 2));
        }
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        return { users: [], plans: {} };
    }
}

function saveDB(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Database write error:', e);
    }
}

let db = loadDB();

const bot = new Bot(BOT_TOKEN);
const app = express();
app.use(express.json());

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 }
});

function escapeHTML(str = '') {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// هندل کردن ارورهای خود بات برای جلوگیری از کرش
bot.catch((err) => {
    console.error(`Error for ${err.ctx.update.update_id}:`, err.error);
});

// ۱. استارت ربات
bot.command('start', async (ctx) => {
    const keyboard = new InlineKeyboard().webApp('✨ ورود به کلینیک رژیم و سلامتی', `${APP_URL}/miniapp`);
    await ctx.reply(
        '👋 <b>به سامانه هوشمند «رژیم و سلامتی» خوش آمدید.</b>\n\n' +
        'برای تکمیل پرونده سلامت، ارسال مدارک یا مشاهده برنامه اختصاصی خود روی دکمه زیر کلیک کنید:',
        { reply_markup: keyboard, parse_mode: 'HTML' }
    );
});

// ۲. ریپلای ادمین در تلگرام
bot.on('message:text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;

    if (userId === ADMIN_CHAT_ID && ctx.message.reply_to_message) {
        const replied = ctx.message.reply_to_message;
        const targetText = replied.text || replied.caption || '';
        const match = targetText.match(/(?:Client_ID|شناسه):\s*`?(\d+)`?/i);
        
        if (match && match[1]) {
            const targetUserId = match[1];
            db = loadDB();
            if (!db.plans[targetUserId]) db.plans[targetUserId] = {};
            db.plans[targetUserId].diet = text;
            saveDB(db);

            try {
                await bot.api.sendMessage(
                    targetUserId,
                    `🌟 <b>دستورات رژیم شما از طرف متخصص صادر شد:</b>\n\n${escapeHTML(text)}`,
                    { parse_mode: 'HTML' }
                );
                await ctx.reply('✅ برنامه با موفقیت در دیتابیس ثبت و برای کاربر ارسال گردید.');
            } catch (err) {
                await ctx.reply('❌ خطا در ارسال به کاربر (احتمالاً ربات متوقف شده است).');
            }
        }
    }
});

// ۳. ثبت پرونده از مینی‌اپ
app.post('/api/submit-diet', upload.single('medicalDoc'), async (req, res) => {
    try {
        const { userId, userName, goal, age, gender, height, weight, activity, allergies } = req.body;
        const file = req.file;

        if (!userId) return res.status(400).json({ success: false, message: 'شناسه نامعتبر' });

        db = loadDB();
        const userData = { 
            userId: String(userId), 
            userName: userName || 'کاربر سیستم', 
            goal, age, gender, height, weight, activity, allergies, 
            hasDoc: !!file,
            date: new Date().toLocaleDateString('fa-IR') 
        };

        const existingIndex = db.users.findIndex(u => String(u.userId) === String(userId));
        if (existingIndex >= 0) db.users[existingIndex] = userData;
        else db.users.unshift(userData);
        
        saveDB(db);

        const report = 
            `📩 <b>پرونده جدید (رژیم و سلامتی)</b>\n\n` +
            `👤 نام: <b>${escapeHTML(userData.userName)}</b>\n` +
            `🆔 Client_ID: <code>${userId}</code>\n` +
            `🎯 هدف: <b>${escapeHTML(goal)}</b>\n` +
            `📅 سن: ${age} | 🚻 جنسیت: ${gender}\n` +
            `📏 قد: ${height} | ⚖️ وزن: ${weight}\n` +
            `🏃‍♂️ فعالیت: ${activity}\n` +
            `⚠️ محدودیت: <b>${escapeHTML(allergies || 'ندارد')}</b>\n` +
            `📎 آزمایش: ${file ? '✅ (تصویر پیوست شد)' : '❌ ندارد'}`;

        if (file) {
            await bot.api.sendPhoto(ADMIN_CHAT_ID, new InputFile(file.buffer, file.originalname), { caption: report, parse_mode: 'HTML' });
        } else {
            await bot.api.sendMessage(ADMIN_CHAT_ID, report, { parse_mode: 'HTML' });
        }

        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ۴. تراکنش پرداخت
app.post('/api/create-payment', async (req, res) => {
    try {
        const { userId, amount, description } = req.body;
        if (ZARINPAL_MERCHANT_ID.includes('xxxx')) {
            return res.status(400).json({ success: false, message: 'درگاه فعال نیست.' });
        }

        const response = await axios.post('https://payment.zarinpal.com/pg/v4/payment/request.json', {
            merchant_id: ZARINPAL_MERCHANT_ID,
            amount: Number(amount) * 10,
            description: description || 'ویزیت رژیم و سلامتی',
            callback_url: `${APP_URL}/api/verify-payment?userId=${userId}&amount=${amount}`
        });

        if (response.data?.data?.code === 100) {
            return res.json({ success: true, paymentUrl: `https://payment.zarinpal.com/pg/StartPay/${response.data.data.authority}` });
        }
        res.status(400).json({ success: false });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.get('/api/verify-payment', async (req, res) => {
    const { Authority, Status, userId, amount } = req.query;
    if (Status !== 'OK') return res.send('<h3 style="text-align:center;color:red;margin-top:50px;">پرداخت لغو شد.</h3>');
    
    try {
        const verifyRes = await axios.post('https://payment.zarinpal.com/pg/v4/payment/verify.json', {
            merchant_id: ZARINPAL_MERCHANT_ID,
            amount: Number(amount) * 10,
            authority: Authority
        });
        const refId = verifyRes.data?.data?.ref_id;
        if (verifyRes.data?.data?.code === 100 || verifyRes.data?.data?.code === 101) {
            await bot.api.sendMessage(userId, `✅ <b>پرداخت تایید شد!</b>\nکد رهگیری: <code>${refId}</code>`, { parse_mode: 'HTML' });
            await bot.api.sendMessage(ADMIN_CHAT_ID, `💰 واریزی جدید: <code>${userId}</code> | کد: <code>${refId}</code>`, { parse_mode: 'HTML' });
            return res.send(`<h2 style="text-align:center;color:green;margin-top:50px;">موفق! کد: ${refId}</h2>`);
        }
        res.send('خطا در تایید.');
    } catch (e) {
        res.send('خطای بانکی.');
    }
});

// ۵. صدور برنامه ادمین
app.post('/api/admin-assign-plan', async (req, res) => {
    try {
        const { adminId, targetUserId, dietPlan, workoutPlan } = req.body;
        if (Number(adminId) !== ADMIN_CHAT_ID) return res.status(403).json({ success: false });

        db = loadDB();
        db.plans[targetUserId] = { diet: dietPlan, workout: workoutPlan };
        saveDB(db);

        await bot.api.sendMessage(
            targetUserId, 
            `🎉 <b>برنامه جدید شما صادر شد!</b>\n\n🥗 <b>تغذیه:</b>\n${escapeHTML(dietPlan) || '—'}\n\n🏋️‍♂️ <b>ورزش:</b>\n${escapeHTML(workoutPlan) || '—'}`,
            { parse_mode: 'HTML' }
        );

        res.status(200).json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

// ۶. دیتا
app.get('/api/admin-users', (req, res) => {
    db = loadDB();
    res.json({ users: db.users, plans: db.plans });
});

app.get('/api/get-user-plan/:userId', (req, res) => {
    db = loadDB();
    res.json(db.plans[req.params.userId] || { notFound: true });
});

// ۷. مینی اپلیکیشن با طراحی خیره‌کننده (Mesh Gradient & Glassmorphism)
app.get('/miniapp', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
        <title>رژیم و سلامتی</title>
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;800;900&display=swap" rel="stylesheet">
        <style>
            :root {
                --surface: rgba(20, 25, 40, 0.65);
                --surface-card: rgba(30, 40, 65, 0.5);
                --border: rgba(255, 255, 255, 0.12);
                --text-main: #ffffff;
                --text-muted: #a1a1aa;
                --primary: #8b5cf6;
                --primary-gradient: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
                --emerald-gradient: linear-gradient(135deg, #10b981 0%, #059669 100%);
            }

            * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }

            /* پس‌زمینه متحرک فوق‌العاده جذاب */
            @keyframes meshGradient {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }

            body {
                font-family: 'Vazirmatn', sans-serif;
                background: linear-gradient(-45deg, #0f172a, #2e1065, #064e3b, #020617);
                background-size: 400% 400%;
                animation: meshGradient 18s ease infinite;
                color: var(--text-main);
                padding: 16px 16px 110px 16px;
                min-height: 100vh;
            }

            /* استایل درخشان هدر */
            .header {
                display: flex; align-items: center; justify-content: space-between;
                padding: 5px 5px 20px 5px;
            }
            .brand-title {
                font-size: 22px; font-weight: 900;
                background: linear-gradient(to right, #e0e7ff, #a5b4fc);
                -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                text-shadow: 0 4px 20px rgba(165, 180, 252, 0.3);
            }
            .brand-sub { font-size: 11px; color: #cbd5e1; font-weight: 600; opacity: 0.8; }
            
            .status-pill {
                display: flex; align-items: center; gap: 6px;
                background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.4);
                color: #34d399; padding: 6px 14px; border-radius: 30px; font-size: 11px; font-weight: 800;
                box-shadow: 0 0 15px rgba(16, 185, 129, 0.2);
            }
            .status-dot {
                width: 6px; height: 6px; border-radius: 50%; background: #10b981;
                box-shadow: 0 0 10px #10b981, 0 0 20px #10b981; animation: pulseDot 2s infinite;
            }
            @keyframes pulseDot { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }

            /* منوی کپسولی معلق پایین (Floating Nav) */
            .bottom-bar {
                position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
                width: 92%; max-width: 450px;
                background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(20px);
                border: 1px solid rgba(255,255,255,0.15); border-radius: 100px;
                display: flex; padding: 6px; gap: 4px; z-index: 1000;
                box-shadow: 0 20px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1);
            }
            .nav-btn {
                flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
                padding: 10px 0; background: transparent; border: none; color: var(--text-muted);
                border-radius: 100px; cursor: pointer; transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1); font-family: inherit;
            }
            .nav-btn .icon { font-size: 20px; margin-bottom: 3px; transition: transform 0.3s; }
            .nav-btn .txt { font-size: 10.5px; font-weight: 800; }
            .nav-btn.active { background: var(--primary-gradient); color: #fff; box-shadow: 0 5px 20px rgba(139, 92, 246, 0.4); }
            .nav-btn.active .icon { transform: scale(1.2) translateY(-2px); }

            .view-pane { display: none; }
            .view-pane.active { display: block; animation: slideFadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
            @keyframes slideFadeUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }

            /* کارت‌های شیشه‌ای پریمیوم */
            .glass-card {
                background: var(--surface); backdrop-filter: blur(25px);
                border: 1px solid var(--border); border-top: 1px solid rgba(255,255,255,0.25);
                border-radius: 28px; padding: 22px; margin-bottom: 16px;
                box-shadow: 0 25px 50px rgba(0,0,0,0.25);
            }
            .card-title-box { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
            .card-head { font-size: 16px; font-weight: 900; color: #fff; }
            .badge-tag { font-size: 10px; background: rgba(255,255,255,0.1); padding: 5px 12px; border-radius: 20px; font-weight:800; }

            .days-track { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 10px; margin-bottom: 15px; scrollbar-width: none; }
            .day-chip {
                padding: 10px 18px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
                border-radius: 100px; color: #cbd5e1; font-size: 12px; font-weight: 800; white-space: nowrap; transition: 0.3s;
            }
            .day-chip.active { background: #fff; color: #0f172a; box-shadow: 0 5px 15px rgba(255,255,255,0.3); }

            .form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
            .field-group { margin-bottom: 14px; }
            label { display: block; font-size: 11.5px; font-weight: 800; color: #cbd5e1; margin-bottom: 8px; }
            input, select, textarea {
                width: 100%; padding: 14px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);
                border-radius: 16px; color: #fff; font-size: 13px; font-family: inherit; transition: 0.3s; outline: none;
            }
            input:focus, select:focus, textarea:focus { border-color: #a855f7; background: rgba(0,0,0,0.5); box-shadow: 0 0 0 4px rgba(168, 85, 247, 0.15); }
            
            /* دکمه آپلود انیمیشنی */
            .file-picker-card {
                border: 2px dashed rgba(168, 85, 247, 0.4); background: rgba(168, 85, 247, 0.05);
                border-radius: 20px; padding: 20px; text-align: center; cursor: pointer; transition: 0.3s;
                position: relative; overflow: hidden;
            }
            .file-picker-card:hover { border-color: #a855f7; background: rgba(168, 85, 247, 0.15); }
            
            /* دکمه‌های اصلی */
            .action-btn {
                width: 100%; padding: 16px; background: var(--primary-gradient); color: #fff;
                border: none; border-radius: 20px; font-size: 15px; font-weight: 900; cursor: pointer;
                box-shadow: 0 10px 25px rgba(139, 92, 246, 0.4); transition: 0.2s; font-family: inherit;
            }
            .action-btn:active { transform: scale(0.96); }

            .pay-btn-glow {
                background: var(--emerald-gradient);
                box-shadow: 0 10px 25px rgba(16, 185, 129, 0.4);
                animation: pulsePay 2.5s infinite;
            }
            @keyframes pulsePay {
                0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
                70% { box-shadow: 0 0 0 15px rgba(16, 185, 129, 0); }
                100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
            }

            .routine-item {
                background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255,255,255,0.05);
                border-radius: 20px; padding: 16px; margin-bottom: 12px;
            }
            .routine-title { font-size: 15px; font-weight: 900; color: #e0e7ff; margin-bottom: 6px; }
            .routine-desc { font-size: 12.5px; color: #cbd5e1; line-height: 1.8; }
        </style>
    </head>
    <body>

        <header class="header">
            <div>
                <h1 class="brand-title" id="top-title">رژیم و سلامتی</h1>
                <p class="brand-sub" id="top-sub">تخصصی‌ترین مرکز تناسب اندام</p>
            </div>
            <div class="status-pill">
                <span class="status-dot"></span><span id="role-tag">آنلاین</span>
            </div>
        </header>

        <div id="admin-view" style="display: none;">
            <div class="glass-card">
                <div class="card-title-box">
                    <span class="card-head">🛡️ پنل پزشک و مراجعین</span>
                    <button style="background:rgba(255,255,255,0.1); border:none; color:#fff; padding:6px 12px; border-radius:12px;" onclick="loadAdminList(true)">🔄 بروزرسانی</button>
                </div>
                <div id="admin-list-container">در حال خواندن اطلاعات...</div>
            </div>
        </div>

        <div id="user-view">
            <!-- تب برنامه -->
            <div id="myplan-tab" class="view-pane active">
                <div class="glass-card">
                    <div class="card-title-box">
                        <span class="card-head">🌟 پرونده سلامت شما</span>
                        <span class="badge-tag">اختصاصی</span>
                    </div>
                    <div id="user-plan-status">در حال دریافت...</div>
                </div>
            </div>

            <!-- تب تغذیه -->
            <div id="diet-tab" class="view-pane">
                <div class="days-track">
                    <button class="day-chip active" onclick="switchDiet('saturday', this)">شنبه</button>
                    <button class="day-chip" onclick="switchDiet('sunday', this)">یکشنبه</button>
                    <button class="day-chip" onclick="switchDiet('monday', this)">دوشنبه</button>
                    <button class="day-chip" onclick="switchDiet('tuesday', this)">سه‌شنبه</button>
                    <button class="day-chip" onclick="switchDiet('wednesday', this)">چهارشنبه</button>
                    <button class="day-chip" onclick="switchDiet('thursday', this)">پنجشنبه</button>
                    <button class="day-chip" onclick="switchDiet('friday', this)">جمعه</button>
                </div>
                <div id="diet-cards-wrapper"></div>
            </div>

            <!-- تب ورزش -->
            <div id="workout-tab" class="view-pane">
                <div class="days-track">
                    <button class="day-chip active" onclick="switchWorkout('w_sat', this)">شنبه</button>
                    <button class="day-chip" onclick="switchWorkout('w_sun', this)">یکشنبه</button>
                    <button class="day-chip" onclick="switchWorkout('w_mon', this)">دوشنبه</button>
                    <button class="day-chip" onclick="switchWorkout('w_tue', this)">سه‌شنبه</button>
                    <button class="day-chip" onclick="switchWorkout('w_wed', this)">چهارشنبه</button>
                    <button class="day-chip" onclick="switchWorkout('w_thu', this)">پنجشنبه</button>
                    <button class="day-chip" onclick="switchWorkout('w_fri', this)">جمعه</button>
                </div>
                <div id="workout-cards-wrapper"></div>
            </div>

            <!-- تب فرم -->
            <div id="profile-tab" class="view-pane">
                <div class="glass-card">
                    <div class="card-title-box">
                        <span class="card-head">📋 فرم آنالیز بدن</span>
                    </div>
                    <form id="dietForm">
                        <div class="field-group">
                            <label>🎯 هدف اصلی شما:</label>
                            <select id="goal" required>
                                <option value="کاهش وزن و چربی‌سوزی">📉 کاهش وزن و چربی‌سوزی</option>
                                <option value="افزایش حجم عضلانی">📈 افزایش حجم و عضله‌سازی</option>
                                <option value="تثبیت و اصلاح الگوی بدنی">⚖️ تثبیت و فرم‌دهی</option>
                            </select>
                        </div>
                        <div class="form-grid-2">
                            <div class="field-group"><label>📅 سن:</label><input type="number" id="age" required></div>
                            <div class="field-group"><label>🚻 جنسیت:</label><select id="gender"><option>خانم</option><option>آقا</option></select></div>
                            <div class="field-group"><label>📏 قد (cm):</label><input type="number" id="height" required></div>
                            <div class="field-group"><label>⚖️ وزن (kg):</label><input type="number" id="weight" required></div>
                        </div>
                        <div class="field-group">
                            <label>🏃‍♂️ سطح فعالیت:</label>
                            <select id="activity" required><option>کم‌تحرک</option><option>متوسط</option><option>پرتحرک (حرفه‌ای)</option></select>
                        </div>
                        <div class="field-group">
                            <label>⚠️ بیماری یا حساسیت غذایی:</label>
                            <textarea id="allergies"></textarea>
                        </div>
                        <div class="field-group">
                            <label>📎 تصویر آزمایش پزشکی (اختیاری):</label>
                            <div class="file-picker-card" onclick="document.getElementById('medicalDoc').click()">
                                <div style="font-size: 28px;">📸</div>
                                <div style="font-size: 13px; font-weight: 800; color: #fff; margin-top:5px;">لمس برای انتخاب عکس</div>
                                <input type="file" id="medicalDoc" accept="image/*" style="display:none;" onchange="handleFileSelect(this)">
                            </div>
                            <div id="file-preview-wrap" style="display:none; margin-top:10px; align-items:center; gap:10px; background:rgba(0,0,0,0.3); padding:10px; border-radius:15px;">
                                <img id="file-preview-img" style="width:50px; height:50px; border-radius:10px; object-fit:cover;">
                                <div style="flex:1;"><div id="file-name-text" style="font-size:12px; color:#34d399; font-weight:800;"></div></div>
                                <button type="button" onclick="clearSelectedFile()" style="background:none; border:none; color:#f87171; font-weight:900;">❌</button>
                            </div>
                        </div>
                        <button type="submit" class="action-btn" id="submit-btn" style="margin-top:10px;">ثبت پرونده و ارسال به متخصص</button>
                    </form>

                    <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
                        <p style="font-size: 13px; text-align:center; color: #e2e8f0; font-weight:800; margin-bottom: 12px;">تعرفه تنظیم رژیم و پشتیبانی: ۲۵۰,۰۰۰ تومان</p>
                        <button class="action-btn pay-btn-glow" onclick="triggerPayment(250000)">💳 پرداخت امن با زرین‌پال</button>
                    </div>
                </div>
            </div>

            <!-- نوار کپسولی پایین -->
            <nav class="bottom-bar">
                <button class="nav-btn active" onclick="navigate('myplan', this)"><span class="icon">🌟</span><span class="txt">برنامه من</span></button>
                <button class="nav-btn" onclick="navigate('diet', this)"><span class="icon">🥗</span><span class="txt">تغذیه</span></button>
                <button class="nav-btn" onclick="navigate('workout', this)"><span class="icon">🏋️‍♂️</span><span class="txt">ورزش</span></button>
                <button class="nav-btn" onclick="navigate('profile', this)"><span class="icon">👤</span><span class="txt">پرونده</span></button>
            </nav>
        </div>

        <script>
            const tg = window.Telegram?.WebApp;
            if(tg) { tg.expand(); tg.ready(); }
            function haptic() { try{ tg?.HapticFeedback?.impactOccurred('medium'); }catch(e){} }

            const ADMIN_ID = 7279065642;
            const urlParams = new URLSearchParams(window.location.search);
            const isAdminByUrl = urlParams.get('admin') == ADMIN_ID;
            const currentUser = tg?.initDataUnsafe?.user || { id: (isAdminByUrl ? ADMIN_ID : 100001), first_name: 'مراجع عزیز' };

            if (currentUser.id == ADMIN_ID) {
                document.getElementById('admin-view').style.display = 'block';
                document.getElementById('user-view').style.display = 'none';
                document.getElementById('top-title').innerText = 'داشبورد ادمین';
                document.getElementById('top-sub').innerText = 'مدیریت رژیم و سلامتی';
                document.getElementById('role-tag').innerText = 'مدیریت';
                loadAdminList();
            } else {
                loadUserProgram();
            }

            function navigate(tabId, el) {
                haptic();
                document.querySelectorAll('.view-pane, .nav-btn').forEach(e => e.classList.remove('active'));
                document.getElementById(tabId + '-tab').classList.add('active');
                el.classList.add('active');
            }

            async function loadUserProgram() {
                try {
                    const res = await fetch('/api/get-user-plan/' + currentUser.id);
                    const data = await res.json();
                    const box = document.getElementById('user-plan-status');
                    if (data.notFound || (!data.diet && !data.workout)) {
                        box.innerHTML = '<div style="text-align:center; padding:30px 10px;"><div style="font-size:45px;">⏳</div><div style="font-weight:900; margin-top:10px;">درحال انتظار...</div><p style="font-size:12px; color:#a1a1aa; margin-top:5px;">فرم خود را تکمیل کنید.</p></div>';
                    } else {
                        box.innerHTML = \`
                            <div style="background:rgba(0,0,0,0.3); border:1px solid rgba(139,92,246,0.3); border-radius:20px; padding:18px; margin-bottom:12px;">
                                <div style="color:#a855f7; font-weight:900; font-size:15px; margin-bottom:8px;">🥗 دستورات تغذیه:</div>
                                <div style="white-space:pre-line; font-size:13px; line-height:1.9;">\${data.diet||'ندارد'}</div>
                            </div>
                            <div style="background:rgba(0,0,0,0.3); border:1px solid rgba(16,185,129,0.3); border-radius:20px; padding:18px;">
                                <div style="color:#34d399; font-weight:900; font-size:15px; margin-bottom:8px;">🏋️‍♂️ دستورات ورزش:</div>
                                <div style="white-space:pre-line; font-size:13px; line-height:1.9;">\${data.workout||'ندارد'}</div>
                            </div>\`;
                    }
                } catch(e){}
            }

            async function loadAdminList() {
                try {
                    const res = await fetch('/api/admin-users');
                    const data = await res.json();
                    const list = document.getElementById('admin-list-container');
                    if(data.users.length === 0) return list.innerHTML = '<p style="text-align:center;">خالی است.</p>';
                    
                    list.innerHTML = data.users.map(u => \`
                        <div style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:24px; padding:20px; margin-bottom:16px;">
                            <h3 style="color:#fff; margin-bottom:10px;">\${u.userName} <span style="font-size:11px; float:left; color:#a1a1aa;">\${u.date}</span></h3>
                            <p style="font-size:12px; line-height:1.8; color:#cbd5e1;">شناسه: \${u.userId}<br>سن: \${u.age} | \${u.gender} | قد: \${u.height} | وزن: \${u.weight}<br>هدف: \${u.goal}<br>بیماری: \${u.allergies}</p>
                            <div style="margin-top:15px;">
                                <textarea id="d_\${u.userId}" placeholder="رژیم...">\${data.plans[u.userId]?.diet||''}</textarea>
                                <textarea id="w_\${u.userId}" style="margin-top:8px;" placeholder="ورزش...">\${data.plans[u.userId]?.workout||''}</textarea>
                                <button class="action-btn" style="margin-top:10px; padding:12px;" onclick="send('\${u.userId}')">ارسال برنامه</button>
                            </div>
                        </div>\`).join('');
                } catch(e){}
            }
            async function send(id) {
                const dietPlan = document.getElementById('d_'+id).value, workoutPlan = document.getElementById('w_'+id).value;
                await fetch('/api/admin-assign-plan', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({adminId: ADMIN_ID, targetUserId: id, dietPlan, workoutPlan})});
                alert('ارسال شد');
            }

            const dietD = { saturday:[{title:"صبحانه",desc:"تخم مرغ + نان جو"}], sunday:[{title:"ناهار",desc:"مرغ گریل"}] };
            function switchDiet(day, btn) {
                haptic(); document.querySelectorAll('#diet-tab .day-chip').forEach(c=>c.classList.remove('active')); btn.classList.add('active');
                document.getElementById('diet-cards-wrapper').innerHTML = (dietD[day]||dietD.saturday).map(m=>\`<div class="routine-item"><div class="routine-title">\${m.title}</div><div class="routine-desc">\${m.desc}</div></div>\`).join('');
            }
            function switchWorkout(day, btn) {
                haptic(); document.querySelectorAll('#workout-tab .day-chip').forEach(c=>c.classList.remove('active')); btn.classList.add('active');
                document.getElementById('workout-cards-wrapper').innerHTML = \`<div class="routine-item" style="border-right:3px solid #10b981;"><div class="routine-title" style="color:#34d399;">تمرین روز</div><div class="routine-desc">۴۵ دقیقه هوازی</div></div>\`;
            }
            switchDiet('saturday', document.querySelector('#diet-tab .day-chip'));
            switchWorkout('w_sat', document.querySelector('#workout-tab .day-chip'));

            function handleFileSelect(input) {
                if(input.files[0]) {
                    haptic();
                    const reader = new FileReader();
                    reader.onload = e => { document.getElementById('file-preview-img').src = e.target.result; document.getElementById('file-preview-wrap').style.display='flex'; }
                    reader.readAsDataURL(input.files[0]);
                }
            }
            function clearSelectedFile() { document.getElementById('medicalDoc').value=''; document.getElementById('file-preview-wrap').style.display='none'; }

            document.getElementById('dietForm').addEventListener('submit', async e => {
                e.preventDefault(); haptic();
                const btn = document.getElementById('submit-btn'); btn.disabled = true; btn.innerHTML = 'درحال ارسال...';
                const fd = new FormData();
                ['goal','age','gender','height','weight','activity','allergies'].forEach(id => fd.append(id, document.getElementById(id).value));
                fd.append('userId', currentUser.id); fd.append('userName', currentUser.first_name);
                if(document.getElementById('medicalDoc').files[0]) fd.append('medicalDoc', document.getElementById('medicalDoc').files[0]);
                await fetch('/api/submit-diet', { method: 'POST', body: fd });
                alert('ثبت شد!'); navigate('myplan', document.querySelector('.bottom-bar .nav-btn'));
                btn.disabled = false; btn.innerHTML = 'ثبت پرونده';
            });
            async function triggerPayment(amount) {
                haptic();
                const res = await fetch('/api/create-payment', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({userId:currentUser.id, amount})});
                const data = await res.json();
                if(data.paymentUrl) tg?.openLink ? tg.openLink(data.paymentUrl) : window.location.href = data.paymentUrl;
            }
        </script>
    </body>
    </html>
    `);
});

// استارت اصولی سرور و بات
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);
    try {
        // فیکس ارور 409: پاک کردن وب‌هوک و آپدیت‌های گیرکرده
        await bot.api.deleteWebhook({ drop_pending_updates: true });
        console.log("Old webhooks cleared.");
        
        bot.start({
            onStart: (botInfo) => {
                console.log(`Bot @${botInfo.username} started successfully!`);
            }
        });
    } catch (err) {
        console.error("Failed to start bot:", err);
    }
});

