# ארבעה אבות — אתר למידה

אתר סטטי (HTML/CSS/JS פשוטים, ללא build step) ללימוד מסכת בבא קמא, שמתחיל בשיעור
"ארבעה אבות נזיקין". האתר תומך RTL, מצב כהה/בהיר, ומבנה שמאפשר להוסיף בקלות שיעורים
חדשים ותמונות/סרטונים לכל שיעור.

## הרצה מקומית

אין תלות בכלים חיצוניים — פשוט פותחים את `index.html` בדפדפן, או מריצים שרת סטטי:

```bash
python3 -m http.server 8000
# ואז נכנסים ל־http://localhost:8000
```

## מבנה התיקיות

```
index.html                          # עמוד הבית עם רשימת השיעורים
register.html                       # הרשמה
login.html                          # התחברות
firestore.rules                     # כללי אבטחה ל-Firestore (מדביקים בקונסולת Firebase)
lessons/
  shor-umave.html                   # השור, הבור, המבעה וההבער (כולל ארבעה אבות נזיקין)
assets/
  css/style.css                     # כל העיצוב
  js/main.js                        # פתיחת הסעיף הראשון בשיעור
  js/firebase-config.js             # פרטי חיבור ל-Firebase (למלא לפי ההנחיות למטה)
  js/auth.js                        # הרשמה/התחברות/התנתקות מול Firebase
  js/header-auth.js                 # עדכון אזור ההתחברות ב-header בכל עמוד
  js/progress.js                    # קריאה/כתיבה של התקדמות בשיעור למשתמש מחובר
  js/lesson-progress.js             # חיווט כפתורי "סימון כהושלם" בעמוד שיעור
  js/score.js                       # עדכון תג הניקוד ב-header לפי תשובות נכונות
  js/quiz.js                        # לוגיקת "שאלות חזרה" (בחירה, בדיקה, ניקוד)
  images/<שם-שיעור>/                # תמונות של השיעור
  videos/<שם-שיעור>/                # סרטונים של השיעור
```

## הוספת תמונה או סרטון לשיעור קיים

בכל שיעור, כל דוגמה מכילה תיבת placeholder בסגנון:

```html
<div class="media-slot" data-media-for="shen-1">
  <span class="icon">🖼️</span>
  <span>מקום לתמונה</span>
  <code>assets/images/arba-avot-nezikin/shen-1.jpg</code>
</div>
```

כדי להחליף אותה בתמונה אמיתית: שמים את הקובץ בנתיב שמופיע בתוך ה־`<code>`,
ומחליפים את כל תוכן ה־`div.media-slot` ב:

```html
<figure class="media-slot" style="border-style: solid; padding: 0;">
  <img src="../assets/images/arba-avot-nezikin/shen-1.jpg" alt="תיאור התמונה" style="border-radius:10px;" />
</figure>
```

לסרטון (קובץ מקומי):

```html
<video controls style="width:100%; border-radius:10px;">
  <source src="../assets/videos/arba-avot-nezikin/shen-2.mp4" type="video/mp4" />
</video>
```

או הטמעת יוטיוב:

```html
<iframe width="100%" height="220" style="border:0; border-radius:10px;"
  src="https://www.youtube.com/embed/VIDEO_ID" allowfullscreen></iframe>
```

## הוספת שיעור חדש

1. יוצרים קובץ חדש תחת `lessons/` (למשל `lessons/mazik-adam-be-adam.html`),
   ומעתיקים ממנו את השלד של `lessons/shor-umave.html` (header, footer, קישור ל־CSS/JS).
2. יוצרים תיקיות מדיה תואמות: `assets/images/<שם-השיעור>/` ו־`assets/videos/<שם-השיעור>/`.
3. מוסיפים כרטיס חדש ל־`index.html` בתוך `.lesson-grid`.

## עיצוב

- כותרות: Frank Ruhl Libre · גוף הטקסט: Heebo (גופני Google Fonts, עברית מלאה).
- לכל אב נזיקין (שן/רגל/בור/אש) יש צבע משלו, המוגדר ב־`assets/css/style.css` תחת המשתנים
  `--shen`, `--regel`, `--bor`, `--esh`.
## הרשמה, התחברות ומעקב התקדמות

גלישה באתר לא דורשת חשבון. משתמש שנרשם (שם פרטי, שם משפחה, טלפון אבא, טלפון אמא,
וקוד אישי בן 4 ספרות) יכול לסמן סעיפים כ"הושלם" בכל שיעור, וההתקדמות נשמרת עבורו.
התחברות היא לפי שם פרטי + שם משפחה + הקוד האישי — אין שם משתמש נפרד.

**מגבלה לדעת:** כניסה מתבססת רק על שם מלא, בלי שם משתמש ייחודי. אם שני אנשים
נרשמים עם אותו שם פרטי ושם משפחה בדיוק, ההרשמה השנייה תיכשל עם הודעה שהשם כבר
תפוס. וקוד בן 4 ספרות (10,000 אפשרויות) הוא נוח לזכירה אך לא מאובטח במיוחד —
מתאים לשמירת התקדמות לימודית ולא למידע רגיש.

זה בנוי על **Firebase** (Authentication + Firestore) — שירות חינמי של Google שמתאים
לאתרים סטטיים כמו זה, בלי לדרוש שרת משלכם.

### הגדרה חד-פעמית

1. נכנסים ל-[console.firebase.google.com](https://console.firebase.google.com/) ויוצרים
   פרויקט חדש (חינמי, לא דורש כרטיס אשראי).
2. **Build → Authentication → Get started** → מפעילים ספק **Email/Password**.
   (המערכת משתמשת בו מאחורי הקלעים כדי לתמוך בהתחברות עם שם מלא וקוד אישי בלבד —
   ראו הסבר ב־`assets/js/auth.js`.)
3. **Build → Firestore Database → Create database** → מצב **Production**.
4. בלשונית **Rules** של Firestore, מדביקים את התוכן של `firestore.rules` מהריפו הזה
   ולוחצים **Publish**.
5. **Project settings → General → Your apps** → מוסיפים אפליקציית **Web** (`</>`),
   ומעתיקים את אובייקט ה-config שמופיע.
6. מדביקים את הערכים בקובץ `assets/js/firebase-config.js` במקום ה-`PASTE_...`.

לאחר מכן הרשמה, התחברות ומעקב התקדמות יעבדו אוטומטית — אין צורך בשינוי קוד נוסף.

### איפה רואים את רשימת הנרשמים

בקונסולת Firebase, תחת **Firestore Database → Data**, באוסף `users` — כל מסמך הוא
משתמש, עם שם פרטי, שם משפחה וטלפוני ההורים. הגישה הזו פתוחה רק לבעל פרויקט
ה-Firebase (כלומר אתה), ולא לגולשים באתר.

## שאלות חזרה וניקוד

בכל שיעור מפוזרות "שאלות חזרה" — שאלה עם 3 תשובות לבחירה. כל אחד יכול לענות
(גם בלי חשבון), אבל רק מי שמחובר צובר ניקוד: על כל תשובה נכונה (פעם ראשונה בלבד
לכל שאלה) מצטברת נקודה, והתג "ניקוד: X" מופיע ליד כפתור ההתנתקות ב-header.

מבחינה טכנית זה נשען על אותו מנגנון של `progress.js` — התשובות הנכונות נשמרות
ב-`users/{uid}/progress/quiz` (מפתח = מזהה שאלה כמו `q7`), אז אין צורך בשינוי
כללי האבטחה או בקוד Firebase נוסף.

**הוספת שאלה חדשה:** מעתיקים בלוק `<div class="quiz" data-question-id="qN">`
קיים מתוך אחד השיעורים, נותנים לו `data-question-id` חדש וייחודי (לא בשימוש
בשום שיעור אחר), ומסמנים `data-correct="true"` על התשובה הנכונה בלבד.

## הדגשת טקסט

טקסט "רגיל" (לא נטוי במקור) נחשב חשוב יותר ומקבל את המחלקה `p-strong`
(מודגש). טקסט נטוי במקור הוא חומר תומך/סיפורי ומקבל את המחלקה `p-light`
(נטוי, בצבע רך יותר). זה נקבע פסקה-פסקה בזמן העריכה — אין קביעה אוטומטית.

## SMS להורים בהגעה לניקוד (`functions/`)

בכל פעם שהניקוד של תלמיד חוצה כפולה של 10 (10, 20, 30...), נשלחת הודעת SMS
אוטומטית להורים (טלפון אבא ואמא, אם קיימים) דרך [SMS4Free](https://www.sms4free.co.il/).
זה רץ כ-**Cloud Function** (`functions/index.js`) שמאזינה לשינויים ב-
`users/{uid}/progress/quiz` — לא קוד שרץ בדפדפן.

### הגדרה חד-פעמית (דורשת טרמינל עם Firebase CLI)

1. **שדרוג ל-Blaze plan** — ב-Firebase Console → Usage and billing → שדרוג
   מ-Spark ל-**Blaze** (דורש כרטיס אשראי בהגדרה; Cloud Functions לא רצות
   בתוכנית החינמית. בהיקף הזה זה יישאר כמעט תמיד בגבולות החינמי של Blaze).
2. **אימות שולח ראשוני ב-SMS4Free** — לפני שימוש ב-API, צריך לשלוח הודעת
   SMS אחת **ידנית** דרך דף השליחה באתר SMS4Free (עם אותו מספר טלפון שאיתו
   נרשמתם). בלי זה כל קריאת API תיכשל עם קוד שגיאה `-6`.
3. **התקנת Firebase CLI** (אם עוד אין): `npm install -g firebase-tools`
   ואז `firebase login`.
4. **הגדרת הסודות** — מריצים בטרמינל (כל פקודה תבקש להדביק ערך, בלי שהוא
   נשמר בהיסטוריית השורה או מוצג כאן):
   ```bash
   firebase functions:secrets:set SMS4FREE_KEY
   firebase functions:secrets:set SMS4FREE_USER
   firebase functions:secrets:set SMS4FREE_PASS
   firebase functions:secrets:set SMS4FREE_SENDER
   ```
   הערכים לוקחים מהאזור האישי באתר SMS4Free (לשונית API): `KEY` = מפתח ה-API
   שלכם, `USER` = מספר הטלפון שאיתו נרשמתם לאתר, `PASS` = הסיסמה שלכם באתר,
   `SENDER` = מזהה השולח (מספר הטלפון, אם לא נרכשה חבילת SMS בשם מותאם).
5. **פריסה:**
   ```bash
   cd functions && npm install && cd ..
   firebase deploy --only functions
   ```

לאחר הפריסה, כל תשובה נכונה שמעלה תלמיד לכפולה חדשה של 10 תפעיל שליחת SMS
אוטומטית — אין צורך בשום שינוי נוסף באתר עצמו.

**לשינוי סף ההודעה** (למשל כל 5 נקודות במקום 10): עורכים את `MILESTONE_STEP`
בראש `functions/index.js` ופורסים מחדש (`firebase deploy --only functions`).
