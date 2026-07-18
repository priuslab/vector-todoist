# Єдиний промпт для AI-дизайнера

Ти — senior product designer і design systems designer, який спеціалізується на mobile-first продуктах, AI-асистентах, productivity apps та доступних інтерфейсах для людей з ADHD. Створи повний high-fidelity UI/UX-дизайн україномовного mobile-first вебзастосунку «Вектор» — AI-планера, який перетворює хаотичні думки користувача на реалістичний план дня та показує, як його ідеї, проєкти й задачі ведуть до головної мети.

Не став уточнювальних запитань. Прийми наведені нижче рішення як затверджений product brief. Не скорочуй перелік екранів і не замінюй функціональні екрани абстрактними концептами. Спочатку створи дизайн-систему, потім компоненти, потім усі екрани й стани, а наприкінці зв'яжи ключові екрани в клікабельний прототип.

## 1. Продукт і користувач

Основна аудиторія — люди з ADHD або високим когнітивним навантаженням. Їм складно утримувати думки в голові, перетворювати ідеї на кроки, реалістично оцінювати час, перебудовувати день після зриву плану й не втрачати зв'язок із довгостроковою метою.

Головна обіцянка: «Вислови все, що в голові. AI сам структурує думки, складе реалістичний план і покаже шлях до твоєї мети».

Принцип продукту — automation with control. AI автоматично створює й планує задачі, але кожне рішення можна відредагувати, зафіксувати або скасувати через Undo.

Інтерфейс і весь реальний UI copy мають бути українською мовою. Англійські назви допускаються лише для звичних брендів або коротких режимів: Google, Telegram, Calendar, Oracle, Balanced, Goal Focus, Deep Work, Routine, Undo, Lifetime Pro.

## 2. Платформа й обмеження

- Створюй лише мобільну версію вебзастосунку.
- Основний frame: 390 × 844 px; перевір адаптацію для ширини 360 px і 430 px.
- Не створюй desktop layouts, tablet layouts або split-view.
- На desktop мобільний продукт просто відображатиметься в центрованому контейнері.
- Усі ключові дії мають бути зручними для керування однією рукою.
- Мінімальна touch-зона — 44 × 44 px; основні кнопки — 52–56 px заввишки.
- Використовуй bottom sheets, drawers і full-screen mobile flows замість desktop-модалок.
- Нижня навігація має п'ять позицій: Today, Inbox, центральна дія Brain Dump, Calendar, Oracle.
- Профіль і Settings відкриваються через аватар у header.
- Врахуй safe areas iOS/Android та появу мобільної клавіатури.

## 3. Візуальна концепція

Характер бренду: спокійний, емпатичний, ясний, розумний, сучасний і надійний. Це не корпоративний task manager і не неоновий sci-fi AI. Продукт повинен зменшувати когнітивний шум. Щоденні екрани стримані; візуальний wow-ефект зосереджений в Oracle-графі та м'яких AI-переходах.

Уникай:

- агресивного червоного як основного кольору;
- надлишкових градієнтів, glassmorphism і glow;
- дрібного тексту та щільних таблиць;
- великої кількості одночасних badge/chip;
- механічного копіювання Todoist;
- дитячої гейміфікації;
- візуального стилю медичного застосунку;
- повідомлень, які соромлять користувача за невиконані задачі.

Тон текстів: підтримувальний, короткий, конкретний, без докорів. Замість «Ти знову не виконав задачу» використовуй «План змінився — я знайшов новий час». Замість «Прострочено 5 задач» — «5 задач потребують нового місця в плані».

## 4. Бренд і дизайн-токени

Використовуй робочу назву «Вектор» і створюй wordmark на основі тексту без складного логотипа. Допустимий знак — проста спрямована крапка/маршрут або три з'єднані вузли. Логотип не повинен затримувати роботу над продуктом.

### Кольори

Створи semantic color styles із такими базовими значеннями:

- `bg/base` — #F6F8F6;
- `bg/surface` — #FFFFFF;
- `bg/subtle` — #EDF2EF;
- `text/primary` — #1F2926;
- `text/secondary` — #63716C;
- `text/tertiary` — #87938E;
- `border/default` — #DCE5E1;
- `brand/primary` — #246B5E;
- `brand/pressed` — #1B5148;
- `brand/soft` — #E5F1ED;
- `accent/sand` — #D19A52;
- `accent/teal` — #178F83;
- `success` — #2E8B57;
- `success/soft` — #E8F5ED;
- `warning` — #B86E00;
- `warning/soft` — #FFF3D6;
- `danger` — #C54848;
- `danger/soft` — #FCEBEC;
- `info` — #2F6FD0;
- `focus/ring` — #3F8C7C.

Кольори Oracle-вузлів:

- Goal — #246B5E;
- Project — #3B74D8;
- Idea — #D88916;
- Task — #168F83;
- Completed — #9AA0AE;
- Recommended edge — #246B5E;
- Regular edge — #CDD1DB.

Кольори вузлів не використовуй як дрібний текст на білому. `accent/sand` використовуй для ідей, хаотичних думок і допоміжної графіки, але не для дрібного тексту чи primary CTA. Забезпеч WCAG AA для основного тексту, кнопок і станів. Значення не передавай лише кольором: додавай icon, label або форму. Не використовуй фіолетовий або violet як основний бренд-колір і уникай шаблонної «purple AI» естетики.

### Типографіка

Основний шрифт — Manrope з повною підтримкою української кирилиці; fallback — Inter, system sans-serif.

- Display: 32/38, 700;
- H1: 28/34, 700;
- H2: 22/28, 700;
- H3: 18/24, 650;
- Body Large: 17/25, 500;
- Body: 15/22, 500;
- Label: 13/18, 600;
- Caption: 12/16, 500;
- Button: 15/20, 650.

Не використовуй текст менший за 12 px. Числа часу в календарі мають читатися швидко.

### Сітка, форма й elevation

- Базова spacing grid: 4 px.
- Основні відступи: 8, 12, 16, 20, 24, 32, 40.
- Горизонтальний padding екрана: 20 px; для вузького 360 px допускається 16 px.
- Radius: 12 px для малих control, 16 px для карток, 20 px для великих карток, 24 px для bottom sheet, capsule 999 px для chips.
- Border: 1 px #DCE5E1.
- Shadow card: 0 4 16 rgba(32,35,48,0.06).
- Shadow floating action: 0 8 24 rgba(36,107,94,0.20).
- Не використовуй більше двох рівнів elevation на одному екрані.

### Іконографіка й ілюстрації

Використовуй прості rounded outline icons товщиною 1.75–2 px, візуально сумісні з Lucide. Не змішуй різні набори. Ілюстрації — лише абстрактні м'які маршрути, вузли й органічні форми; без персонажів-маскотів.

### Motion

- microinteraction: 160 ms;
- screen/bottom-sheet transition: 240 ms;
- easing: ease-out;
- запис голосу — м'яка пульсація, а не яскравий строб;
- перепланування — плавне переміщення карток із чітким Undo;
- Oracle — фізично природний рух вузлів без постійного хаосу;
- передбач reduced-motion state.

## 5. Компонентна бібліотека

Створи окрему сторінку/секцію Foundations і окрему сторінку Components. Використай Auto Layout, constraints, variables/tokens і variants. Компоненти мають бути готовими для передачі розробнику.

Обов'язкові компоненти та стани:

- button: primary, secondary, tertiary, destructive, icon, Google; default/pressed/disabled/loading;
- floating Brain Dump button: idle/recording/processing;
- input: text, search, textarea, voice transcript; default/focus/error/disabled;
- checkbox/task completion control;
- task card: scheduled, current, completed, overdue-needs-reschedule, locked, syncing;
- idea card, project card, goal card;
- priority, energy, alignment і source chips;
- status badge;
- date/time/duration picker rows;
- segmented control;
- switch;
- slider або discrete selector для енергії й навантаження;
- progress ring і linear progress;
- overload indicator;
- calendar event block: Google event, flexible task, locked task, focus block;
- day strip і week strip;
- bottom navigation;
- top app bar;
- bottom sheet;
- toast/snackbar з Undo;
- inline AI insight;
- empty state;
- skeleton/loading state;
- error banner і pending-sync banner;
- paywall feature row;
- Oracle node: Goal, Project, Idea, Task, Completed, selected, dimmed;
- Oracle edge: default, recommended, AI-suggested, selected;
- filter chip і filters sheet;
- Telegram connection status;
- audio recorder з waveform, timer, stop/cancel;
- AI processing steps;
- Pomodoro timer controls.

## 6. Повний перелік екранів і станів

Створи кожен наведений нижче frame у high fidelity. Використовуй реалістичний український контент, а не lorem ipsum.

### A. Entry та авторизація

1. Mobile landing carousel — три окремі high-fidelity стани одного pre-auth flow:
   - `Chaos to Plan` — стартовий і головний слайд: ціннісна пропозиція та демонстрація «хаос → реалістичний план»;
   - `Voice to Plan` — голосова думка перетворюється на структуровані задачі;
   - `Path to Goal` — короткий preview маршруту «думки → проєкт → наступна задача → мета».
   На всіх трьох слайдах CTA `Продовжити з Google` залишається у фіксованій нижній action-зоні. Додай свайп ліворуч/праворуч і зрозумілий індикатор `1/3`, `2/3`, `3/3`. Автоперехід — раз на 6 секунд лише до першої взаємодії; після дотику, focus або ручного свайпу він зупиняється. За `prefers-reduced-motion` автоперехід вимкнений. Карусель ніколи не запускає Google-вхід автоматично.
2. Google authorization loading.
3. Помилка входу з retry.

### B. Онбординг

4. Welcome з коротким поясненням 3 кроків.
5. Calendar permission: пояснення, навіщо потрібен доступ.
6. Робочі дні та години.
7. Тихі години й частота Telegram-повідомлень.
8. Піковий час енергії.
9. Довжина фокус-блоку, перерви й денний ліміт.
10. Вибір мети: «Ввести вручну», «Визначити з AI», «Продовжити без мети».
11. Ручне введення головної мети: формулювання, причина, бажаний результат, строк.
12. Старт AI-тесту визначення мети; покажи структуру майбутнього короткого діалогу без вигадування остаточного протоколу.
13. Результат AI-тесту з можливістю підтвердити або відредагувати мету.
14. Попередження при продовженні без мети: функції задач доступні, Oracle обмежений.
15. Підключення Telegram через deep link/QR не потрібен; на мобільному головна дія — «Відкрити Telegram».
16. Telegram успішно підключено.
17. Запрошення зробити перший Brain Dump.

### C. Voice/Text Capture та AI

18. Brain Dump chooser: голос або текст.
19. Voice recording: waveform, timer, cancel, finish.
20. Live transcript під час запису.
21. AI processing зі зрозумілими етапами: «Розпізнаю думки», «Знаходжу задачі», «Перевіряю календар», «Складаю план».
22. Одне критичне уточнення від AI з quick replies та voice reply.
23. Два послідовні уточнення — покажи друге питання без відчуття довгої анкети.
24. AI Result: створені задачі, ідеї та проєкт; куди вони заплановані; CTA «Переглянути день» і Undo.
25. Transcript needs review: низька якість аудіо, редагування або повторний запис.
26. AI failure: brain dump збережений у Inbox, повторити обробку.

### D. Today

27. Today — перший порожній стан із Brain Dump CTA.
28. Today — нормальний запланований день: greeting, progress, Now, Next, timeline.
29. Today — активна задача Deep Work.
30. Today — перевантажений день із м'якою AI-рекомендацією.
31. Today — план автоматично перебудовано; banner із переліком змін і Undo.
32. Today — усі задачі виконані, спокійний позитивний завершальний стан.
33. Evening review: виконано, перенесено, короткий AI-insight, завершити день.

### E. Inbox, Ideas та Projects

34. Inbox із сегментами «Задачі», «Ідеї», «Чернетки».
35. Inbox filters/search.
36. Необроблена чернетка зі статусом AI processing failed.
37. Idea Detail: AI-підсумок, зв'язок із метою, пов'язані вузли, «Розбити на задачі» або «Залишити в backlog».
38. AI decomposition preview: майбутній проєкт, етапи та задачі до підтвердження.
39. Project Detail: результат, прогрес, задачі, пов'язані ідеї та мета.

### F. Task Detail і Focus

40. Task Detail view.
41. Task Edit: назва, опис, дедлайн, дата/час, тривалість, пріоритет, енергія, flexible/locked, проєкт і мета.
42. Підзадачі: додавання, reorder, completion.
43. Pomodoro setup.
44. Focus Mode із таймером, назвою задачі, pause/finish і мінімумом відволікань.
45. Focus session completed: фактичний час і коротка рефлексія.

### G. Calendar

46. Day Calendar: горизонтальні дати, вертикальний timeline, Google events і AI tasks.
47. Week overview у компактному мобільному форматі.
48. Drag-and-drop task state із доступним slot highlight.
49. Event/Task bottom sheet.
50. Calendar conflict detected.
51. Calendar offline/pending sync.

### H. Oracle

52. Oracle default Balanced: force-directed graph у стилі Obsidian.
53. Goal selected: bottom sheet і dimmed unrelated nodes.
54. Idea selected: зв'язки, alignment і CTA «Розбити на задачі».
55. Show Path: яскравий пронумерований маршрут, решта мережі приглушена.
56. Oracle filters sheet: тип, мета/проєкт, статус, період, alignment, енергія, recommended path only.
57. Goal Focus activation confirmation з поясненням, що буде відкладено.
58. Goal Focus active: сфокусований граф і короткий список наступних кроків.
59. AI suggested connection: підтвердити або відхилити ребро.
60. Path list fallback: той самий рекомендований маршрут у вигляді вертикальних карток.
61. Oracle empty/without goal state.

Важливо для Oracle: це жива мережа, не mind map і не org chart. Вузли можуть мати багато зв'язків. Підтримай pan, pinch-to-zoom, drag, tap, double-tap to center. Goal — найбільший вузол. При виборі вузла непов'язані елементи затемнюються. Show Path підсвічує маршрут «ідея → проєкт → задачі → мета» або «мета → проєкти → найближчі кроки».

### I. Goals і monetization

62. Goals: одна активна безкоштовна мета, прогрес і пов'язані проєкти.
63. Add second goal trigger.
64. Lifetime Pro paywall: одноразово $100, необмежені цілі, без підписки; чесний короткий текст.
65. Stripe Checkout handoff/loading.
66. Payment success: Lifetime Pro active.
67. Payment failed/cancelled з retry.

### J. Settings та інтеграції

68. Profile & Settings home.
69. Work rhythm settings.
70. Energy & focus settings.
71. Notifications і quiet hours.
72. Telegram connected/disconnected states.
73. Google Calendar connected/syncing/error states.
74. AI adaptation: що система вивчила, запропонована зміна, accept/reject.
75. Pro status і restore state.

### K. Глобальні системні стани

76. Offline.
77. Generic error із безпечною наступною дією.
78. Loading/skeleton для Today, Inbox, Calendar та Oracle.
79. Undo snackbar.
80. Confirmation для незворотної ручної дії.

## 7. Реалістичний демонстраційний контент

Використовуй один узгоджений профіль у всіх екранах:

- користувачка: Олена;
- головна мета: «Запустити перший сезон подкасту про кар'єрні зміни до 30 вересня»;
- робочі години: 09:00–18:00;
- пік енергії: 09:30–12:30;
- Google-подія: «Командний синк», 11:00–11:45;
- Deep Work задача: «Підготувати структуру першого епізоду», 60 хв;
- Routine задача: «Написати лист потенційному гостю», 20 хв;
- ідея: «Зробити епізод про синдром самозванця»;
- проєкт: «Пілотний епізод»;
- нейтральна задача: «Замовити корм коту»;
- низькоузгоджена ідея: «Почати паралельно YouTube-канал».

Приклад brain dump: «Мені треба підготувати перший випуск подкасту, написати Марії про запис, ще не забути замовити корм коту. Думаю зробити окремий епізод про синдром самозванця, але не знаю, чи варто зараз ще запускати YouTube. У четвер об 11 у мене командний синк».

Не змінюй імена, мету та приклади між екранами. Дані Calendar, Today, Oracle і Task Detail мають логічно збігатися.

## 8. UX-правила

- Одна основна CTA на екран; secondary actions візуально слабші.
- AI не соромить і не тисне.
- Прострочена задача називається такою, що «потребує нового часу».
- Locked Google events ніколи не виглядають draggable.
- AI-рекомендації явно позначені як рекомендації.
- Будь-яке автоматичне перепланування має видимий Undo.
- Ідея не потрапляє в календар автоматично: спочатку зберігається в backlog і пропонує декомпозицію.
- Balanced є режимом за замовчуванням.
- Goal Focus не видаляє дані, а тимчасово прибирає нерелевантне з активного плану.
- Одна мета безкоштовна. Спроба додати другу відкриває Lifetime Pro paywall.
- Порожні стани завжди пояснюють одну наступну дію.
- Не показуй одночасно більше трьох AI-insight або warning.
- Пріоритет показуй спокійно, без суцільного червоного інтерфейсу.

## 9. Prototype flows

Зв'яжи в клікабельний прототип щонайменше такі сценарії:

1. Landing → Google → onboarding → мета → Telegram → first Brain Dump.
2. Voice recording → transcript → AI clarification → AI Result → Today → Calendar.
3. Today → task → Focus Mode → complete → evening review.
4. Telegram-originated task represented in Inbox/Today.
5. Missed task → automatic reschedule → Undo.
6. Inbox idea → decompose → project/tasks → schedule.
7. Oracle → select idea → filters → Show Path → Goal Focus.
8. Goals → add second goal → paywall → payment success.
9. Settings → adaptation suggestion → accept/reject.

## 10. Формат фінального результату

Підготуй:

1. сторінку `00 Foundations` із кольорами, typography, spacing, radii, shadows, icons і motion notes;
2. сторінку `01 Components` з Auto Layout, variants і documented states;
3. сторінку `02 User Flows` зі схемами ключових сценаріїв;
4. сторінку `03 Screens` з усіма 80 high-fidelity frames, згрупованими за розділами A–K;
5. сторінку `04 Prototype` з ключовими зв'язаними сценаріями;
6. сторінку `05 Handoff` з tokens, component behavior, responsive constraints, edge cases і нотатками для розробника.

Додай до кожного frame коротку назву й state label. Покажи loading, empty, error, success, disabled, pressed, offline, syncing і Undo там, де це релевантно. Не використовуй lorem ipsum. Не додавай desktop-екрани. Не вигадуй нові великі функції. Якщо є конфлікт між візуальним ефектом і зрозумілістю для людини з ADHD, обирай зрозумілість.

Перед фінальною видачею самостійно перевір:

- чи всі 80 frames створено;
- чи в усіх екранах узгоджені дані Олени;
- чи компоненти повторно використовуються, а не намальовані вручну;
- чи тексти українською;
- чи touch targets не менші за 44 px;
- чи основний текст і CTA відповідають WCAG AA;
- чи Oracle справді працює як force-directed semantic graph у стилі Obsidian;
- чи ключові сценарії можна пройти в prototype без тупиків;
- чи всі автоматичні зміни мають зрозумілий Undo;
- чи дизайн виглядає спокійним, цілісним і готовим до передачі розробнику.
