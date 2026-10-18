// content-english.js — банк вопросов «Английский язык» (2–5 классы)
// Каждый класс 2–5 получает не менее 200 вопросов; повторов нет.
(function () {
  'use strict';

  // d1 — простое (классы 2,3,4)
  var EASY = [
    'cat|кошка','dog|собака','cow|корова','pig|свинья','horse|лошадь','sheep|овца','duck|утка','hen|курица','mouse|мышь','bear|медведь','fox|лиса','wolf|волк','rabbit|кролик','fish|рыба','bird|птица','frog|лягушка','lion|лев','tiger|тигр','elephant|слон','monkey|обезьяна',
    'red|красный','blue|синий','green|зелёный','yellow|жёлтый','black|чёрный','white|белый','orange|оранжевый','brown|коричневый','pink|розовый','grey|серый',
    'one|один','two|два','three|три','four|четыре','five|пять','six|шесть','seven|семь','eight|восемь','nine|девять','ten|десять',
    'mother|мама','father|папа','sister|сестра','brother|брат','grandmother|бабушка','grandfather|дедушка','family|семья','friend|друг',
    'apple|яблоко','milk|молоко','bread|хлеб','water|вода','tea|чай','juice|сок','cake|торт','egg|яйцо','cheese|сыр','meat|мясо',
    'head|голова','hand|рука','eye|глаз','nose|нос','mouth|рот','ear|ухо','leg|нога','hair|волосы',
    'house|дом','table|стол','chair|стул','bed|кровать','door|дверь','window|окно','book|книга','pen|ручка','bag|сумка','ball|мяч','toy|игрушка',
    'sun|солнце','moon|луна','star|звезда','sky|небо','tree|дерево','flower|цветок','grass|трава','rain|дождь','snow|снег','wind|ветер',
    'go|идти','run|бежать','jump|прыгать','swim|плавать','eat|есть','drink|пить','sleep|спать','play|играть','read|читать','write|писать','sing|петь','draw|рисовать',
    'hello|привет','goodbye|пока','yes|да','no|нет','please|пожалуйста','thanks|спасибо','sorry|извини','good|хороший','bad|плохой','big|большой','small|маленький'
  ];

  // d2 — среднее (классы 3,4,5)
  var MED = [
    'school|школа','teacher|учитель','pupil|ученик','lesson|урок','class|класс','desk|парта','clock|часы','board|доска',
    'river|река','sea|море','mountain|гора','forest|лес','field|поле','garden|сад','island|остров','lake|озеро','bridge|мост','road|дорога',
    'snake|змея','turtle|черепаха','dolphin|дельфин','butterfly|бабочка','spider|паук','ant|муравей','bee|пчела','camel|верблюд','penguin|пингвин','owl|сова',
    'long|длинный','short|короткий','new|новый','old|старый','fast|быстрый','slow|медленный','happy|счастливый','sad|грустный','clean|чистый','dirty|грязный','warm|тёплый','cool|прохладный',
    'see|видеть','hear|слышать','speak|говорить','walk|гулять','fly|летать','sit|сидеть','stand|стоять','open|открывать','close|закрывать','help|помогать','work|работать','cook|готовить',
    'day|день','night|ночь','morning|утро','evening|вечер','week|неделя','month|месяц','year|год','hour|час'
  ];

  // d3 — сложное (классы 4,5)
  var HARD = [
    'Monday|понедельник','Tuesday|вторник','Wednesday|среда','Thursday|четверг','Friday|пятница','Saturday|суббота','Sunday|воскресенье',
    'January|январь','February|февраль','March|март','April|апрель','May|май','June|июнь','July|июль','August|август','September|сентябрь','October|октябрь','November|ноябрь','December|декабрь',
    'twenty|двадцать','thirty|тридцать','forty|сорок','fifty|пятьдесят','sixty|шестьдесят','seventy|семьдесят','eighty|восемьдесят','ninety|девяносто','hundred|сто','thousand|тысяча',
    'spring|весна','summer|лето','autumn|осень','winter|зима',
    'under|под','behind|за','near|рядом','between|между','above|выше','below|ниже','with|с','without|без','before|до','after|после',
    'understand|понимать','remember|помнить','forget|забывать','buy|покупать','sell|продавать','give|давать','take|брать','find|находить','lose|терять','make|делать','begin|начинать','finish|заканчивать','answer|отвечать','ask|спрашивать',
    'beautiful|красивый','difficult|трудный','easy|лёгкий','important|важный','interesting|интересный','dangerous|опасный','funny|смешной','strong|сильный','weak|слабый','young|молодой','heavy|тяжёлый','deep|глубокий','wide|широкий','narrow|узкий',
    'homework|домашняя работа','break|перемена','pencil|карандаш','ruler|линейка','eraser|ластик','notebook|тетрадь','dictionary|словарь','question|вопрос','story|рассказ','letter|письмо'
  ];

  var items = [];
  function load(list, d, grades) {
    for (var i = 0; i < list.length; i++) {
      var p = list[i].split('|');
      items.push({ en: p[0], ru: p[1], d: d, grades: grades });
    }
  }
  load(EASY, 1, [2, 3, 4]);
  load(MED, 2, [3, 4, 5]);
  load(HARD, 3, [4, 5]);

  var enPool = [];
  var ruPool = [];
  for (var i2 = 0; i2 < items.length; i2++) { enPool.push(items[i2].en); ruPool.push(items[i2].ru); }

  var bank = [];
  var seen = {};
  function addQ(q, right, pool, idx, fact, d, grades) {
    var opts = [right];
    var used = {};
    used[right] = 1;
    var k = 0;
    while (opts.length < 4 && k < pool.length) {
      var cand = pool[(idx + k) % pool.length];
      k++;
      if (cand && !used[cand]) { used[cand] = 1; opts.push(cand); }
    }
    if (opts.length < 4) return;
    var key = q + '||' + right;
    if (seen[key]) return;
    seen[key] = 1;
    var rot = bank.length % 4;
    for (var r = 0; r < rot; r++) opts.push(opts.shift());
    bank.push({ q: q, a: opts, correct: opts.indexOf(right), fact: fact, d: d, grades: grades.slice() });
  }

  for (var j = 0; j < items.length; j++) {
    var it = items[j];
    addQ('Как по-английски «' + it.ru + '»?', it.en, enPool, j + 1, 'Слово «' + it.en + '» переводится как «' + it.ru + '».', it.d, it.grades);
    addQ('Что значит английское слово «' + it.en + '»?', it.ru, ruPool, j + 1, '«' + it.en + '» по-английски значит «' + it.ru + '».', it.d, it.grades);
  }

  window.EDU_ENGLISH = bank;
})();
