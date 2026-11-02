const { Bot, InlineKeyboard } = require('grammy');
const express = require('express');

const BOT_TOKEN = '9016404137:AAEj85yDR8ax_WSJTccSKjpFr9FnXk8bsv8';
const ADMIN_CHAT_ID = 7279065642;
const APP_URL = 'https://telegram-diet-bot-adxs.onrender.com';

const bot = new Bot(BOT_TOKEN);
const app = express();
app.use(express.json());

// ۱. دستور شروع و دکمه باز کردن مینی‌اپ
bot.command('start', async (ctx) => {
    const keyboard = new InlineKeyboard().webApp('🚀 ورود به اپلیکیشن رژیم و ورزش', `${APP_URL}/miniapp`);
    await ctx.reply('سلام! به کلینیک تخصصی رژیم و تناسب اندام خوش آمدید. 🥗🏋️‍♂️\nبرای مشاهده برنامه غذایی، برنامه ورزشی و ثبت مشخصات، روی دکمه زیر کلیک کنید:', {
        reply_markup: keyboard
    });
});

// ۲. سیستم پاسخ‌دهی ادمین به کاربران با Reply
bot.on('message:text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;

    if (userId === ADMIN_CHAT_ID && ctx.message.reply_to_message) {
        const replyText = ctx.message.reply_to_message.text;
        const match = replyText && replyText.match(/Client_ID:\s*(\d+)/);
        
        if (match && match[1]) {
            const targetUserId = match[1];
            try {
                await bot.api.sendMessage(targetUserId, `🥗 پاسخ برنامه رژیم و تمرین از طرف متخصص:\n\n${text}`);
                await ctx.reply('✅ برنامه با موفقیت برای کاربر ارسال شد.');
            } catch (err) {
                await ctx.reply('❌ خطا در ارسال پیام به کاربر.');
            }
            return;
        }
    }
});

// ۳. دریافت اطلاعات کامل از مینی‌اپ (شامل تغذیه، ورزش و آلرژی‌ها)
app.post('/api/submit-diet', async (req, res) => {
    try {
        const { userId, userName, goal, age, gender, height, weight, activity, allergies } = req.body;

        await bot.api.sendMessage(
            ADMIN_CHAT_ID,
            `📩 درخواست جدید رژیم و ورزش از مینی‌اپ!\n\n` +
            `👤 نام: ${userName || 'ثبت نشده'}\n` +
            `🆔 Client_ID: ${userId}\n` +
            `🎯 هدف: ${goal}\n` +
            `📅 سن: ${age} سال\n` +
            `🚻 جنسیت: ${gender}\n` +
            `📏 قد: ${height} سانتی‌متر\n` +
            `⚖️ وزن: ${weight} کیلوگرم\n` +
            `🏃‍♂️ سطح تحرک: ${activity}\n` +
            `⚠️ محدودیت/آلرژی: ${allergies || 'ندارد'}`
        );

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error handling WebApp data:', error);
        res.status(500).json({ success: false });
    }
});

// ۴. طراحی گرافیکی و پیشرفته مینی‌اپ (تغذیه + ورزش + چیت‌دی + پروفایل)
app.get('/miniapp', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>اپلیکیشن رژیم و تناسب اندام</title>
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        <style>
            :root {
                --bg-color: var(--tg-theme-bg-color, #0f172a);
                --card-bg: var(--tg-theme-secondary-bg-color, #1e293b);
                --text-color: var(--tg-theme-text-color, #f8fafc);
                --hint-color: var(--tg-theme-hint-color, #94a3b8);
                --primary-color: var(--tg-theme-button-color, #3b82f6);
                --primary-text: var(--tg-theme-button-text-color, #ffffff);
            }
            body {
                font-family: system-ui, -apple-system, sans-serif;
                background-color: var(--bg-color);
                color: var(--text-color);
                margin: 0;
                padding: 14px;
                padding-bottom: 90px;
            }
            .header {
                text-align: center;
                margin-bottom: 16px;
            }
            .header h1 {
                font-size: 20px;
                margin: 0;
                color: var(--primary-color);
            }
            .header p {
                font-size: 12px;
                color: var(--hint-color);
                margin: 4px 0 0 0;
            }
            /* تب‌های پایین/بالا */
            .tabs {
                display: flex;
                background: var(--card-bg);
                border-radius: 12px;
                padding: 4px;
                margin-bottom: 16px;
                box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
                overflow-x: auto;
            }
            .tab-btn {
                flex: 1;
                padding: 8px 4px;
                text-align: center;
                border: none;
                background: transparent;
                color: var(--text-color);
                font-size: 12px;
                font-weight: 600;
                border-radius: 8px;
                cursor: pointer;
                transition: 0.3s;
                white-space: nowrap;
            }
            .tab-btn.active {
                background: var(--primary-color);
                color: var(--primary-text);
            }
            .tab-content {
                display: none;
            }
            .tab-content.active {
                display: block;
            }
            /* اسکرول روزهای هفته */
            .days-scroll {
                display: flex;
                gap: 6px;
                overflow-x: auto;
                padding-bottom: 8px;
                margin-bottom: 12px;
            }
            .day-btn {
                padding: 6px 14px;
                background: var(--card-bg);
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 16px;
                color: var(--text-color);
                font-size: 12px;
                white-space: nowrap;
                cursor: pointer;
            }
            .day-btn.active {
                background: var(--primary-color);
                color: var(--primary-text);
                border-color: transparent;
            }
            .card {
                background: var(--card-bg);
                border-radius: 14px;
                padding: 14px;
                margin-bottom: 12px;
                box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
                border-right: 4px solid var(--primary-color);
            }
            .card-title {
                font-weight: bold;
                font-size: 14px;
                margin-bottom: 4px;
                color: var(--primary-color);
            }
            .card-desc {
                font-size: 13px;
                color: var(--hint-color);
                margin: 0;
                line-height: 1.4;
            }
            /* بخش فرم */
            .form-group {
                margin-bottom: 12px;
            }
            label {
                display: block;
                margin-bottom: 4px;
                font-weight: 600;
                font-size: 12px;
            }
            input, select, textarea {
                width: 100%;
                padding: 10px;
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 8px;
                box-sizing: border-box;
                background-color: var(--bg-color);
                color: var(--text-color);
                font-size: 13px;
            }
            textarea { resize: vertical; height: 60px; }
            .submit-btn {
                width: 100%;
                padding: 12px;
                background-color: var(--primary-color);
                color: var(--primary-text);
                border: none;
                border-radius: 10px;
                font-weight: bold;
                font-size: 15px;
                margin-top: 10px;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
            }
            /* بنرها */
            .banner {
                background: linear-gradient(135deg, #f59e0b, #d97706);
                color: #fff;
                padding: 16px;
                border-radius: 14px;
                text-align: center;
                margin-bottom: 12px;
            }
            .banner.workout {
                background: linear-gradient(135deg, #10b981, #059669);
            }
            .banner h3 { margin: 0 0 6px 0; font-size: 16px; }
            .banner p { margin: 0; font-size: 12px; opacity: 0.9; line-height: 1.5; }
        </style>
    </head>
    <body>

        <div class="header">
            <h1>کلینیک تخصصی رژیم و تمرین</h1>
            <p>برنامه غذایی، اصول رژیم‌درمانی و برنامه ورزشی علمی</p>
        </div>

        <!-- نوار تب‌ها -->
        .tabs {
        <div class="tabs">
            <button class="tab-btn active" onclick="switchTab('diet', this)">🥗 تغذیه</button>
            <button class="tab-btn" onclick="switchTab('workout', this)">🏋️‍♂️ ورزش</button>
            <button class="tab-btn" onclick="switchTab('cheat', this)">🍔 چیت‌دی</button>
            <button class="tab-btn" onclick="switchTab('profile', this)">👤 پروفایل</button>
        </div>

        <!-- تب اول: برنامه غذایی و رژیم‌درمانی -->
        <div id="diet-tab" class="tab-content active">
            <div class="banner">
                <h3>💧 راهنمای آب و درشت‌مغذی‌ها</h3>
                <p>روزانه حداقل ۳۵ میلی‌لیتر آب به ازای هر کیلوگرم وزن بدن بنوشید. تعادل پروتئین و فیبر کلید موفقیت شماست.</p>
            </div>
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

        <!-- تب دوم: برنامه ورزشی -->
        <div id="workout-tab" class="tab-content">
            <div class="banner workout">
                <h3>🔥 برنامه تمرینی هفته</h3>
                <p>تمرینات با وزنه همراه با هوازی منظم برای چربی‌سوزی و حفظ عضلات.</p>
            </div>
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

        <!-- تب سوم: چیت‌دی -->
        <div id="cheat-tab" class="tab-content">
            <div class="banner" style="background: linear-gradient(135deg, #8b5cf6, #6d28d9);">
                <h3>🍕 روز آزاد هوشمند (Cheat Meal)</h3>
                <p>انعطاف در رژیم برای حفظ سلامت روان و جلوگیری از افت متابولیسم.</p>
            </div>
            <div class="card">
                <div class="card-title">🎯 اصول علمی چیت‌دی:</div>
                <p class="card-desc">
                    • به جای کل روز، فقط **یک وعده** را به غذای دلخواه اختصاص دهید.<br>
                    • حتماً پیش از وعده آزاد، آب کافی بنوشید تا کنترل اشتها حفظ شود.<br>
                    • روز بعد از چیت‌دی، تمرین هوازی یا پیاده‌روی ناشتا فراموش نشود.
                </p>
            </div>
        </div>

        <!-- تب چهارم: پروفایل و فرم ارسال اطلاعات -->
        <div id="profile-tab" class="tab-content">
            <div class="card">
                <form id="dietForm">
                    <div class="form-group">
                        <label>🎯 هدف اصلی:</label>
                        <select id="goal" required>
                            <option value="کاهش وزن">📉 کاهش وزن و چربی‌سوزی</option>
                            <option value="افزایش وزن">📈 افزایش حجم و عضلات</option>
                            <option value="تثبیت و سلامت">⚖️ تثبیت وزن و بهبود سلامت</option>
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
                            <option value="کم‌تحرک">کم‌تحرک (کار پشت‌میزی)</option>
                            <option value="متوسط">متوسط (ورزش سبک ۲ تا ۳ روز در هفته)</option>
                            <option value="پرتحرک">پرتحرک (ورزش حرفه‌ای ۴ تا ۵ روز)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>⚠️ آلرژی یا محدودیت غذایی (اختیاری):</label>
                        <textarea id="allergies" placeholder="مثلاً حساسیت به لبنیات، دیسک کمر، و..."></textarea>
                    </div>
                    <button type="submit" class="submit-btn">ارسال اطلاعات کامل برای متخصص</button>
                </form>
            </div>
        </div>

        <script>
            const tg = window.Telegram.WebApp;
            tg.expand();

            function switchTab(tabName, btn) {
                document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
                document.querySelectorAll('.tab-btn').forEach(el => {
                    el.classList.remove('active');
                    el.style.background = 'transparent';
                    el.style.color = 'var(--text-color)';
                });
                
                document.getElementById(tabName + '-tab').classList.add('active');
                if(btn) {
                    btn.classList.add('active');
                    btn.style.background = 'var(--primary-color)';
                    btn.style.color = 'var(--primary-text)';
                }
            }

            // اطلاعات برنامه غذایی
            const weeklyDiet = {
                saturday: [
                    { title: "🌅 صبحانه", desc: "تخم‌مرغ آب‌پز ۲ عدد + نان جو ۱ کف دست + چای سبز" },
                    { title: "🥗 ناهار", desc: "سینه مرغ گریل شده ۲۰۰ گرم + برنج قهوه‌ای ۶ قاشق" },
                    { title: "🍎 میان‌وعده", desc: "یک عدد سیب + ۱۰ عدد بادام درختی" },
                    { title: "🌙 شام", desc: "سوپ سبزیجات رژیمی + سالاد فصل با روغن زیتون" }
                ],
                sunday: [
                    { title: "🌅 صبحانه", desc: "املت گوجه‌فرنگی کم‌روغن + نان سنگک سبوس‌دار" },
                    { title: "🥗 ناهار", desc: "خورشت قیمه کم‌چرب + برنج ایرانی ۵ قاشق" },
                    { title: "🍎 میان‌وعده", desc: "موز کوچک + یک فنجان قهوه تلخ" },
                    { title: "🌙 شام", desc: "ماهی تن آبکش شده + خیارشور و کاهو" }
                ],
                monday: [
                    { title: "🌅 صبحانه", desc: "پنیر کم‌چرب + گردو ۲ عدد + چای" },
                    { title: "🥗 ناهار", desc: "گوشت گوساله کبابی یا آبپز + سبزیجات بخارپز" },
                    { title: "🍎 میان‌وعده", desc: "توت خشک یا خرما (۲ عدد)" },
                    { title: "🌙 شام", desc: "املت قارچ و اسفناج + سالاد شیرازی" }
                ],
                tuesday: [
                    { title: "🌅 صبحانه", desc: "فرنی با شیر کم‌چرب و عسل طبیعی" },
                    { title: "🥗 ناهار", desc: "عدسی با سیب‌زمینی کوچک + لیموترش تازه" },
                    { title: "🍎 میان‌وعده", desc: "پرتقال یا مرکبات فصل" },
                    { title: "🌙 شام", desc: "مرغ آب‌پز ریش‌ریش شده با سالاد کلم" }
                ],
                wednesday: [
                    { title: "🌅 صبحانه", desc: "تخم‌مرغ نیمرو در تابه رژیمی + نان جو" },
                    { title: "🥗 ناهار", desc: "خورشت قورمه‌سبزی کم‌گوشت و کم‌روغن + برنج" },
                    { title: "🍎 میان‌وعده", desc: "مشتری مغزیجات (پسته و بادام)" },
                    { title: "🌙 شام", desc: "کوکو سبزی رژیمی (پخت در فر)" }
                ],
                thursday: [
                    { title: "🌅 صبحانه", desc: "ارده و شیره انگور به مقدار کم + نان سبوس‌دار" },
                    { title: "🥗 ناهار", desc: "استیک بوقلمون یا مرغ + سیب‌زمینی تنوری" },
                    { title: "🍎 میان‌وعده", desc: "انار یا میوه فصل" },
                    { title: "🌙 شام", desc: "سالاد سزار رژیمی بدون سس مایونز سنگین" }
                ],
                friday: [
                    { title: "🌅 صبحانه", desc: "املت اسفناج + چای دارچین" },
                    { title: "🥗 ناهار", desc: "جوجه کباب خانگی بدون چربی اضافه + برنج" },
                    { title: "🍎 میان‌وعده", desc: "سالاد میوه تازه" },
                    { title: "🌙 شام", desc: "خوراک لوبیا چیتی با قارچ و لیمو" }
                ]
            };

            // اطلاعات برنامه ورزشی
            const weeklyWorkout = {
                w_sat: [
                    { title: "💪 بالاتنه (سینه و پشت‌بازو)", desc: "پرس بالا سینه دمبل (۳ ست ۱۰ تایی) + شنا سوئدی (۳ ست تا خرابی) + پشت‌بازو سیم‌کش (۳ ست ۱۲ تایی)" },
                    { title: "🏃‍♂️ هوازی", desc: "۲۰ دقیقه تردمیل با شیب ملایم بعد از تمرین" }
                ],
                w_sun: [
                    { title: "🦵 پایین‌تنه (پا و باسن)", desc: "اسکات با هالت یا دمبل (۴ ست ۱۰ تایی) + لانگ دمبل (۳ ست هر پا ۱۲ تایی) + پشت پا دستگاه (۳ ست ۱۲ تایی)" },
                    { title: "🧘‍♂️ ریکاوری", desc: "حرکات کششی و انعطاف‌پذیری (۱۵ دقیقه)" }
                ],
                w_mon: [
                    { title: "🏃‍♂️ روز هوازی تخصصی", desc: "۴۵ دقیقه دویدن ملایم یا دوچرخه ثابت + طناب زدن اصولی" }
                ],
                w_tue: [
                    { title: "🦾 بالاتنه (سرشانه و زیربغل)", desc: "بارفیکس یا زیربغل سیم‌کش (۴ ست ۱۰ تایی) + سرشانه دمبل نشسته (۳ ست ۱۲ تایی) + نشر جانب (۳ ست ۱۵ تایی)" },
                    { title: "🛡️ شکم و پهلو", desc: "پلانک (۳ ست ۶۰ ثانیه) + کرانچ شکم (۳ ست ۱۵ تایی)" }
                ],
                w_wed: [
                    { title: "🦵 پایین‌تنه (مخصوص عضلات پشت پا و ساق)", desc: "دالیگ‌لیفت رومانیایی با دمبل (۴ ست ۱۰ تایی) + ساق پا ایستاده (۴ ست ۱۵ تایی)" }
                ],
                w_thu: [
                    { title: "⚡ فول‌بادی سبک / فانکشنال", desc: "تمرینات با وزن بدن، کیتل‌بل و حرکات ترکیبی برای چربی‌سوزی کل بدن (۳۵ دقیقه)" }
                ],
                w_fri: [
                    { title: "🌿 استراحت مطلق (Rest Day)", desc: "بدون تمرین سنگین؛ استراحت کامل عضلات و پیاده‌روی سبک آزاد." }
                ]
            };

            function selectDay(dayKey, btn) {
                document.querySelectorAll('#diet-tab .day-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const container = document.getElementById('meals-container');
                const meals = weeklyDiet[dayKey] || [];
                container.innerHTML = meals.map(m => \`
                    <div class="card">
                        <div class="card-title">\${m.title}</div>
                        <p class="card-desc">\${m.desc}</p>
                    </div>
                \`).join('');
            }

            function selectWorkout(dayKey, btn) {
                document.querySelectorAll('#workout-tab .day-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const container = document.getElementById('workout-container');
                const workouts = weeklyWorkout[dayKey] || [];
                container.innerHTML = workouts.map(w => \`
                    <div class="card" style="border-right-color: #10b981;">
                        <div class="card-title" style="color: #10b981;">\${w.title}</div>
                        <p class="card-desc">\${w.desc}</p>
                    </div>
                \`).join('');
            }

            selectDay('saturday', document.querySelector('#diet-tab .day-btn'));
            selectWorkout('w_sat', document.querySelector('#workout-tab .day-btn'));

            // ارسال فرم کامل پروفایل
            document.getElementById('dietForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const user = tg.initDataUnsafe?.user || {};
                const data = {
                    userId: user.id || 7279065642,
                    userName: user.first_name || 'کاربر',
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
                    tg.showAlert('اطلاعات کامل و پرسشنامه شما با موفقیت ثبت و برای متخصص ارسال شد!');
                    tg.close();
                } else {
                    alert('خطایی در ثبت اطلاعات رخ داد.');
                }
            });
        </script>
    </body>
    </html>
    `);
});

// ۵. روشن کردن سرور و ربات
bot.start();
console.log('مینی‌اپ تخصصی رژیم و ورزش روشن شد...');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
