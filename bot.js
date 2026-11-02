const { Bot, InlineKeyboard } = require('grammy');
const express = require('express');

const BOT_TOKEN = '9016404137:AAEj85yDR8ax_WSJTccSKjpFr9FnXk8bsv8';
const ADMIN_CHAT_ID = 7279065642;
const APP_URL = 'https://telegram-diet-bot-adxs.onrender.com';

const bot = new Bot(BOT_TOKEN);
const app = express();
app.use(express.json());

// دیتابیس موقت در حافظه سرور
let usersSubmissions = [];
let assignedPlans = {}; // کلید: userId، مقدار: { diet, workout }

// ۱. دستور شروع ربات
bot.command('start', async (ctx) => {
    const keyboard = new InlineKeyboard().webApp('✨ ورود به اپلیکیشن پادین', `${APP_URL}/miniapp`);
    await ctx.reply('سلام! به کلینیک تخصصی رژیم و تناسب اندام پادین خوش آمدید. 🥗🏋️‍♂️\nبرای ورود به اپلیکیشن و مشاهده یا ثبت برنامه‌ها، روی دکمه زیر کلیک کنید:', {
        reply_markup: keyboard
    });
});

// ۲. پاسخ ادمین با Reply در تلگرام
bot.on('message:text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;

    if (userId === ADMIN_CHAT_ID && ctx.message.reply_to_message) {
        const replyText = ctx.message.reply_to_message.text;
        const match = replyText && replyText.match(/Client_ID:\s*(\d+)/);
        
        if (match && match[1]) {
            const targetUserId = match[1];
            if (!assignedPlans[targetUserId]) assignedPlans[targetUserId] = {};
            assignedPlans[targetUserId].diet = text;
            try {
                await bot.api.sendMessage(targetUserId, `🌟 **برنامه جدید شما از طرف متخصص آماده شد:**\n\n${text}`);
                await ctx.reply('✅ برنامه با موفقیت برای کاربر ارسال شد.');
            } catch (err) {
                await ctx.reply('❌ خطا در ارسال پیام به کاربر.');
            }
            return;
        }
    }
});

// ۳. دریافت ثبت‌نام از مینی‌اپ
app.post('/api/submit-diet', async (req, res) => {
    try {
        const { userId, userName, goal, age, gender, height, weight, activity, allergies } = req.body;
        
        const existingIndex = usersSubmissions.findIndex(u => u.userId == userId);
        const userData = { userId, userName, goal, age, gender, height, weight, activity, allergies, date: new Date().toLocaleDateString('fa-IR') };
        
        if (existingIndex >= 0) {
            usersSubmissions[existingIndex] = userData;
        } else {
            usersSubmissions.push(userData);
        }

        await bot.api.sendMessage(
            ADMIN_CHAT_ID,
            `📩 **درخواست جدید رژیم و ورزش!**\n\n` +
            `👤 نام: ${userName || 'ثبت نشده'}\n` +
            `🆔 Client_ID: ${userId}\n` +
            `🎯 هدف: ${goal}\n` +
            `📅 سن: ${age} سال | 🚻 جنسیت: ${gender}\n` +
            `📏 قد: ${height} سانتی‌متر | ⚖️ وزن: ${weight} کیلوگرم\n` +
            `🏃‍♂️ تحرک: ${activity}\n` +
            `⚠️ آلرژی: ${allergies || 'ندارد'}`
        );

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false });
    }
});

// ۴. ثبت برنامه توسط ادمین از داخل مینی‌اپ
app.post('/api/admin-assign-plan', async (req, res) => {
    try {
        const { adminId, targetUserId, dietPlan, workoutPlan } = req.body;
        if (Number(adminId) !== ADMIN_CHAT_ID) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        assignedPlans[targetUserId] = { diet: dietPlan, workout: workoutPlan };

        await bot.api.sendMessage(targetUserId, `🎉 **برنامه تخصصی جدید شما ثبت شد!**\n\n🥗 **تغذیه:**\n${dietPlan}\n\n🏋️‍♂️ **ورزش:**\n${workoutPlan}`);
        res.status(200).json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ۵. دریافت لیست کاربران برای ادمین
app.get('/api/admin-users', (req, res) => {
    res.json({ users: usersSubmissions, plans: assignedPlans });
});

// ۶. دریافت برنامه کاربر خاص
app.get('/api/get-user-plan/:userId', (req, res) => {
    const userId = req.params.userId;
    res.json(assignedPlans[userId] || { notFound: true });
});

// ۷. مینی‌اپلیکیشن با طراحی فوق‌العاده لاکچری و جداسازی کامل پنل ادمین
app.get('/miniapp', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>کلینیک تناسب اندام پادین</title>
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        <style>
            :root {
                --bg: #0b0f19;
                --card-bg: rgba(30, 41, 59, 0.75);
                --card-border: rgba(255, 255, 255, 0.08);
                --text: #f8fafc;
                --hint: #94a3b8;
                --primary: #6366f1;
                --primary-gradient: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
                --accent: #10b981;
            }
            body {
                font-family: system-ui, -apple-system, sans-serif;
                background-color: var(--bg);
                background-image: radial-gradient(circle at top right, rgba(99, 102, 241, 0.12), transparent 50%),
                                  radial-gradient(circle at bottom left, rgba(16, 185, 129, 0.08), transparent 50%);
                color: var(--text);
                margin: 0;
                padding: 16px;
                padding-bottom: 90px;
                min-height: 100vh;
            }
            .header {
                text-align: center;
                margin-bottom: 20px;
            }
            .header h1 {
                font-size: 22px;
                font-weight: 800;
                margin: 0;
                background: var(--primary-gradient);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            .header p {
                font-size: 13px;
                color: var(--hint);
                margin: 6px 0 0 0;
            }
            /* نوار تب‌ها */
            .tabs {
                display: flex;
                background: var(--card-bg);
                backdrop-filter: blur(12px);
                border: 1px solid var(--card-border);
                border-radius: 16px;
                padding: 5px;
                margin-bottom: 20px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            }
            .tab-btn {
                flex: 1;
                padding: 10px 6px;
                text-align: center;
                border: none;
                background: transparent;
                color: var(--hint);
                font-size: 13px;
                font-weight: 700;
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            .tab-btn.active {
                background: var(--primary-gradient);
                color: #ffffff;
                box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
            }
            .tab-content {
                display: none;
            }
            .tab-content.active {
                display: block;
                animation: fadeIn 0.3s ease;
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(6px); }
                to { opacity: 1; transform: translateY(0); }
            }
            /* کارت‌ها */
            .card {
                background: var(--card-bg);
                backdrop-filter: blur(12px);
                border: 1px solid var(--card-border);
                border-radius: 20px;
                padding: 18px;
                margin-bottom: 16px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.2);
            }
            .card-title {
                font-weight: 700;
                font-size: 15px;
                margin-bottom: 8px;
                color: #818cf8;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .card-desc {
                font-size: 13px;
                color: var(--hint);
                margin: 0;
                line-height: 1.6;
            }
            /* اسکرول روزهای هفته */
            .days-scroll {
                display: flex;
                gap: 8px;
                overflow-x: auto;
                padding-bottom: 10px;
                margin-bottom: 16px;
                scrollbar-width: none;
            }
            .days-scroll::-webkit-scrollbar { display: none; }
            .day-btn {
                padding: 8px 16px;
                background: var(--card-bg);
                border: 1px solid var(--card-border);
                border-radius: 20px;
                color: var(--hint);
                font-size: 13px;
                font-weight: 600;
                white-space: nowrap;
                cursor: pointer;
                transition: 0.3s;
            }
            .day-btn.active {
                background: var(--primary-gradient);
                color: #fff;
                border-color: transparent;
                box-shadow: 0 4px 12px rgba(99, 102, 241,.3);
            }
            /* فرم‌ها */
            .form-group {
                margin-bottom: 14px;
            }
            label {
                display: block;
                margin-bottom: 6px;
                font-weight: 600;
                font-size: 12px;
                color: var(--hint);
            }
            input, select, textarea {
                width: 100%;
                padding: 12px;
                border: 1px solid var(--card-border);
                border-radius: 12px;
                box-sizing: border-box;
                background-color: rgba(15, 23, 42, 0.7);
                color: var(--text);
                font-size: 13px;
                outline: none;
                transition: 0.3s;
            }
            input:focus, select:focus, textarea:focus {
                border-color: #6366f1;
                box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
            }
            textarea { resize: vertical; height: 75px; }
            .btn {
                width: 100%;
                padding: 14px;
                background: var(--primary-gradient);
                color: #ffffff;
                border: none;
                border-radius: 14px;
                font-weight: 700;
                font-size: 15px;
                cursor: pointer;
                box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
                transition: 0.3s;
            }
            .btn:active { transform: scale(0.98); }
            /* استایل پنل مدیریت ادمین */
            .admin-container {
                padding: 4px;
            }
            .admin-card {
                background: linear-gradient(145deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95));
                border: 1px solid rgba(99, 102, 241, 0.4);
                border-radius: 20px;
                padding: 18px;
                margin-bottom: 16px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.4);
            }
            .admin-card h3 {
                color: #a5b4fc;
                margin-top: 0;
                font-size: 16px;
                border-bottom: 1px solid rgba(255,255,255,0.1);
                padding-bottom: 8px;
            }
        </style>
    </head>
    <body>

        <div class="header">
            <h1 id="app-main-title">کلینیک تناسب اندام پادین</h1>
            <p id="app-main-subtitle">سامانه هوشمند رژیم‌درمانی و ورزش</p>
        </div>

        <!-- اگر ادمین باشد، فقط پنل مدیریت نشان داده می‌شود -->
        <div id="admin-view" style="display:none;" class="admin-container">
            <div class="admin-card">
                <h3>🛡️ داشبورد مدیریت مراجعات و بیماران</h3>
                <p class="card-desc">لیست کاربران ثبت‌نام کرده و فرم‌های ارسالی برای تدوین برنامه:</p>
                <div id="admin-users-list" style="margin-top: 14px;">در حال بارگذاری لیست مراجعات...</div>
            </div>
        </div>

        <!-- اگر کاربر عادی باشد، تب‌ها و محتوا نشان داده می‌شود -->
        <div id="user-view">
            <div class="tabs">
                <button class="tab-btn active" onclick="switchTab('myplan', this)">🌟 برنامه من</button>
                <button class="tab-btn" onclick="switchTab('diet', this)">🥗 تغذیه</button>
                <button class="tab-btn" onclick="switchTab('workout', this)">🏋️‍♂️ ورزش</button>
                <button class="tab-btn" onclick="switchTab('profile', this)">👤 پروفایل</button>
            </div>

            <!-- تب ۱: برنامه اختصاصی من -->
            <div id="myplan-tab" class="tab-content active">
                <div class="card" style="text-align: center; padding: 24px;">
                    <h3 style="color: #34d399; margin-top:0;">📋 وضعیت برنامه اختصاصی شما</h3>
                    <div id="user-assigned-plan" style="text-align: right; margin-top: 14px; font-size: 13px; line-height: 1.6;">
                        در حال بارگذاری برنامه از سرور...
                    </div>
                </div>
            </div>

            <!-- تب ۲: تغذیه پیش‌فرض -->
            <div id="diet-tab" class="tab-content">
                <div class="days-scroll">
                    <button class="day-btn active" onclick="selectDay('saturday', this)">شنبه</button>
                    <button class="day-btn" onclick="selectDay('sunday', this)">یکشنبه</button>
                    <button class="day-btn" onclick="selectDay('monday', this)">دوشنبه</button>
                    <button class="day-btn" onclick="selectDay('tuesday', this)">سه‌شنبه</button>
                    <button class="day-btn" onclick="selectDay('wednesday', this)">چهارشنبه</button>
                    <button class="day-btn" onclick="selectDay('thursday', this)">پنجشنبه</button>
                    <button class="day-btn" onclick="selectDay('friday', this)">جمعه</button>
                </div>
                <div id="meals-container"></div>
            </div>

            <!-- تب ۳: ورزش پیش‌فرض -->
            <div id="workout-tab" class="tab-content">
                <div class="days-scroll">
                    <button class="day-btn active" onclick="selectWorkout('w_sat', this)">شنبه</button>
                    <button class="day-btn" onclick="selectWorkout('w_sun', this)">یکشنبه</button>
                    <button class="day-btn" onclick="selectWorkout('w_mon', this)">دوشنبه</button>
                    <button class="day-btn" onclick="selectWorkout('w_tue', this)">سه‌شنبه</button>
                    <button class="day-btn" onclick="selectWorkout('w_wed', this)">چهارشنبه</button>
                    <button class="day-btn" onclick="selectWorkout('w_thu', this)">پنجشنبه</button>
                    <button class="day-btn" onclick="selectWorkout('w_fri', this)">جمعه</button>
                </div>
                <div id="workout-container"></div>
            </div>

            <!-- تب ۴: پروفایل و فرم -->
            <div id="profile-tab" class="tab-content">
                <div class="card">
                    <div class="card-title">📝 ثبت و ویرایش مشخصات</div>
                    <form id="dietForm">
                        <div class="form-group">
                            <label>🎯 هدف اصلی:</label>
                            <select id="goal" required>
                                <option value="کاهش وزن">📉 کاهش وزن و چربی‌سوزی</option>
                                <option value="افزایش وزن">📈 افزایش حجم و عضلات</option>
                                <option value="تثبیت وزن">⚖️ تثبیت و تناسب اندام</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>📅 سن:</label>
                            <input type="number" id="age" placeholder="مثلاً ۲۶" required>
                        </div>
                        <div class="form-group">
                            <label>🚻 جنسیت:</label>
                            <select id="gender" required>
                                <option value="زن">خانم</option>
                                <option value="مرد">آقا</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>📏 قد (سانتی‌متر):</label>
                            <input type="number" id="height" placeholder="مثلاً ۱۷۸" required>
                        </div>
                        <div class="form-group">
                            <label>⚖️ وزن فعلی (کیلوگرم):</label>
                            <input type="number" id="weight" placeholder="مثلاً ۷۵" required>
                        </div>
                        <div class="form-group">
                            <label>🏃‍♂️ سطح فعالیت بدنی:</label>
                            <select id="activity" required>
                                <option value="کم‌تحرک">کم‌تحرک (پشت‌میزی)</option>
                                <option value="متوسط">متوسط (ورزش سبک ۲-۳ روز)</option>
                                <option value="پرتحرک">پرتحرک (ورزش حرفه‌ای)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>⚠️ محدودیت یا آلرژی:</label>
                            <textarea id="allergies" placeholder="مثلاً دیسک کمر، حساسیت به لبنیات..."></textarea>
                        </div>
                        <button type="submit" class="btn">ثبت و ارسال اطلاعات</button>
                    </form>
                </div>
            </div>
        </div>

        <script>
            const tg = window.Telegram.WebApp;
            tg.expand();
            const currentUser = tg.initDataUnsafe?.user || { id: 7279065642, first_name: 'ادمین سیستم' };
            const ADMIN_ID = 7279065642;

            // اگر کاربر ادمین بود، نمای ادمین فعال شود و نمای کاربر مخفی شود
            if (Number(currentUser.id) === Number(ADMIN_ID)) {
                document.getElementById('admin-view').style.display = 'block';
                document.getElementById('user-view').style.display = 'none';
                document.getElementById('app-main-title').innerText = 'پنل مدیریت ادمین (پادین)';
                document.getElementById('app-main-subtitle').innerText = 'مدیریت مراجعات و صدور برنامه';
                loadAdminData();
            } else {
                loadUserPlan();
            }

            // سیستم جا‌به‌جایی بین تب‌ها به صورت کاملاً روان و بدون باگ
            function switchTab(tabName, btn) {
                document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
                document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
                
                document.getElementById(tabName + '-tab').classList.add('active');
                if (btn) btn.classList.add('active');
            }

            async function loadUserPlan() {
                try {
                    const res = await fetch(\`/api/get-user-plan/\${currentUser.id}\`);
                    const data = await res.json();
                    const container = document.getElementById('user-assigned-plan');
                    if (data.notFound) {
                        container.innerHTML = \`<p style="color:var(--hint)">هنوز برنامه‌ای از طرف متخصص برای شما ثبت نشده است. لطفاً فرم پروفایل را پر کنید تا بررسی شود.</p>\`;
                    } else {
                        container.innerHTML = \`
                            <div style="margin-bottom: 14px;"><strong style="color:#818cf8;">🥗 برنامه تغذیه:</strong><br><div style="background:rgba(15,23,42,0.6); padding:10px; border-radius:10px; margin-top:4px;">\${data.diet || 'ثبت نشده'}</div></div>
                            <div><strong style="color:#34d399;">🏋️‍♂️ برنامه ورزشی:</strong><br><div style="background:rgba(15,23,42,0.6); padding:10px; border-radius:10px; margin-top:4px;">\${data.workout || 'ثبت نشده'}</div></div>
                        \`;
                    }
                } catch(e) {
                    console.error(e);
                }
            }

            async function loadAdminData() {
                try {
                    const res = await fetch('/api/admin-users');
                    const data = await res.json();
                    const listContainer = document.getElementById('admin-users-list');
                    
                    if (data.users.length === 0) {
                        listContainer.innerHTML = '<p style="color:var(--hint); text-align:center; padding:20px;">هنوز هیچ کاربری فرم ثبت‌نام را پر نکرده است.</p>';
                        return;
                    }

                    listContainer.innerHTML = data.users.map(u => \`
                        <div style="background: rgba(15, 23, 42, 0.75); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 14px; margin-bottom: 12px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                <h4 style="margin:0; color:#a5b4fc; font-size:15px;">👤 \${u.userName}</h4>
                                <span style="font-size:11px; color:var(--hint);">تاریخ: \${u.date}</span>
                            </div>
                            <p style="margin:3px 0; font-size:12px; color:var(--hint);">🆔 شناسه: \${u.userId}</p>
                            <p style="margin:3px 0; font-size:12px; color:var(--text);">🎯 هدف: <b>\${u.goal}</b> | 📅 سن: \${u.age} سال | 🚻 جنسیت: \${u.gender}</p>
                            <p style="margin:3px 0; font-size:12px; color:var(--text);">📏 قد: \${u.height} سم | ⚖️ وزن: \${u.weight} کیلو | 🏃‍♂️ تحرک: \${u.activity}</p>
                            <p style="margin:3px 0; font-size:12px; color:#f87171;">⚠️ آلرژی/محدودیت: \${u.allergies || 'ندارد'}</p>
                            
                            <div style="margin-top: 12px; border-top:1px solid rgba(255,255,255,0.08); pt:10px;">
                                <label style="margin-top:8px;">متن برنامه تغذیه:</label>
                                <textarea id="diet_\${u.userId}" placeholder="برنامه غذایی اختصاصی..."></textarea>
                                
                                <label style="margin-top:8px;">متن برنامه ورزشی:</label>
                                <textarea id="workout_\${u.userId}" placeholder="برنامه ورزشی اختصاصی..." style="margin-top:4px;"></textarea>
                                
                                <button class="btn" style="margin-top:10px; padding:10px; font-size:13px;" onclick="sendPlanToUser(\${u.userId})">ارسال برنامه برای کاربر</button>
                            </div>
                        </div>
                    \`).join('');
                } catch(e) {
                    console.error(e);
                }
            }

            async function sendPlanToUser(targetId) {
                const dietPlan = document.getElementById(\`diet_\${targetId}\`).value;
                const workoutPlan = document.getElementById(\`workout_\${targetId}\`).value;

                if (!dietPlan && !workoutPlan) {
                    alert('لطفاً حداقل متن یکی از برنامه‌ها را وارد کنید.');
                    return;
                }

                const res = await fetch('/api/admin-assign-plan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ adminId: currentUser.id, targetUserId: targetId, dietPlan, workoutPlan })
                });

                if (res.ok) {
                    alert('برنامه با موفقیت ثبت و برای کاربر ارسال شد!');
                    loadAdminData();
                } else {
                    alert('خطا در ارسال برنامه.');
                }
            }

            // اطلاعات پیش‌فرض تغذیه و ورزش
            const weeklyDiet = {
                saturday: [{title: "🌅 صبحانه", desc: "تخم‌مرغ آب‌پز ۲ عدد + نان جو + چای سبز"}, {title: "🥗 ناهار", desc: "سینه مرغ گریل شده + برنج قهوه‌ای"}],
                sunday: [{title: "🌅 صبحانه", desc: "املت گوجه‌فرنگی + سنگک سبوس‌دار"}, {title: "🥗 ناهار", desc: "خورشت قیمه کم‌چرب + برنج"}],
                monday: [{title: "🌅 صبحانه", desc: "پنیر کم‌چرب + گردو + چای"}, {title: "🥗 ناهار", desc: "گوشت گوساله کبابی + سبزیجات"}],
                tuesday: [{title: "🌅 صبحانه", desc: "فرنی با شیر کم‌چرب و عسل"}, {title: "🥗 ناهار", desc: "عدسی با سیب‌زمینی کوچک و لیمو"}],
                wednesday: [{title: "🌅 صبحانه", desc: "نیمرو رژیمی + نان جو"}, {title: "🥗 ناهار", desc: "قورمه‌سبزی کم‌روغن + برنج"}],
                thursday: [{title: "🌅 صبحانه", desc: "ارده و شیره انگور + نان سبوس‌دار"}, {title: "🥗 ناهار", desc: "استیک بوقلمون + سیب‌زمینی تنوری"}],
                friday: [{title: "🌅 صبحانه", desc: "املت اسفناج + چای دارچین"}, {title: "🥗 ناهار", desc: "جوجه کباب خانگی + برنج"}]
            };

            const weeklyWorkout = {
                w_sat: [{title: "💪 بالاتنه (سینه و پشت‌بازو)", desc: "پرس بالا سینه دمبل + شنا سوئدی"}],
                w_sun: [{title: "🦵 پایین‌تنه (پا و باسن)", desc: "اسکات با دمبل + لانگ تعادلی"}],
                w_mon: [{title: "🏃‍♂️ هوازی تخصصی", desc: "۴۵ دقیقه دویدن ملایم یا تردمیل"}],
                w_tue: [{title: "🦾 سرشانه و زیربغل", desc: "بارفیکس یا سیم‌کش + سرشانه دمبل"}],
                w_wed: [{title: "🦵 پشت پا و ساق", desc: "دالیگ‌لیفت رومانیایی + ساق پا"}],
                w_thu: [{title: "⚡ فول‌بادی فانکشنال", desc: "تمرینات ترکیبی چربی‌سوزی کل بدن"}],
                w_fri: [{title: "🌿 استراحت و ریکاوری", desc: "پیاده‌روی سبک آزاد در طبیعت"}]
            };

            function selectDay(dayKey, btn) {
                document.querySelectorAll('#diet-tab .day-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('meals-container').innerHTML = (weeklyDiet[dayKey] || []).map(m => \`
                    <div class="card"><div class="card-title">\${m.title}</div><p class="card-desc">\${m.desc}</p></div>
                \`).join('');
            }

            function selectWorkout(dayKey, btn) {
                document.querySelectorAll('#workout-tab .day-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('workout-container').innerHTML = (weeklyWorkout[dayKey] || []).map(w => \`
                    <div class="card" style="border-right: 4px solid var(--accent);"><div class="card-title" style="color:var(--accent);">\${w.title}</div><p class="card-desc">\${w.desc}</p></div>
                \`).join('');
            }

            selectDay('saturday', document.querySelector('#diet-tab .day-btn'));
            selectWorkout('w_sat', document.querySelector('#workout-tab .day-btn'));

            document.getElementById('dietForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const data = {
                    userId: currentUser.id,
                    userName: currentUser.first_name || 'کاربر',
                    goal: document.getElementById('goal').value,
                    age: document.getElementById('age').value,
                    gender: document.getElementById('gender').value,
                    height: document.getElementById('height').value,
                    weight: document.getElementById('weight').value,
                    activity: document.getElementById('activity').value,
                    allergies: document.getElementById('allergies').value
                };
                const res = await fetch('/api/submit-diet', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (res.ok) {
                    tg.showAlert('اطلاعات شما با موفقیت ثبت شد!');
                    switchTab('myplan', document.querySelector('.tab-btn'));
                    loadUserPlan();
                }
            });
        </script>
    </body>
    </html>
    `);
});

bot.start();
console.log('مینی‌اپ با پنل مدیریت مجزا و تب‌های روان روشن شد...');
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on port ${PORT}`));
