import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { lint, applyConfig } from '../src/linter.js';
import { rules } from '../src/rules.js';

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function findings(text, ruleId) {
  return lint(text, rules).filter(f => f.ruleId === ruleId);
}

function hits(text, ruleId) {
  return findings(text, ruleId).length > 0;
}

function clean(text, ruleId) {
  return !hits(text, ruleId);
}

// ─────────────────────────────────────────
// EMOJI
// ─────────────────────────────────────────

describe('emoji', () => {
  it('catches basic emoji', () => {
    assert.ok(hits('Привет 🎉 мир', 'emoji'));
    assert.ok(hits('✨ Отличный текст', 'emoji'));
    assert.ok(hits('Результат: 💯', 'emoji'));
    assert.ok(hits('🔥 Топ список', 'emoji'));
    assert.ok(hits('Готово ✅', 'emoji')); // also caught by checkmarks
  });

  it('passes text without emoji', () => {
    assert.ok(clean('Обычный текст без украшений.', 'emoji'));
    assert.ok(clean('Результат: 100%', 'emoji'));
    assert.ok(clean('Раздел 1.2.3', 'emoji'));
  });
});

// ─────────────────────────────────────────
// ARROWS
// ─────────────────────────────────────────

describe('arrows', () => {
  it('catches arrow characters', () => {
    assert.ok(hits('Шаг 1 → Шаг 2', 'arrows'));
    assert.ok(hits('⇒ результат', 'arrows'));
    assert.ok(hits('← назад', 'arrows'));
    assert.ok(hits('➜ готово', 'arrows'));
    assert.ok(hits('▶ видео', 'arrows'));
  });

  it('passes regular text', () => {
    assert.ok(clean('Шаг 1 — Шаг 2', 'arrows'));
    assert.ok(clean('Результат >= 0', 'arrows'));
  });
});

// ─────────────────────────────────────────
// CHECKMARKS
// ─────────────────────────────────────────

describe('checkmarks', () => {
  it('catches unicode checkmarks and crosses', () => {
    assert.ok(hits('✓ Сделано', 'checkmarks'));
    assert.ok(hits('✔ Выполнено', 'checkmarks'));
    assert.ok(hits('✗ Не сделано', 'checkmarks'));
    assert.ok(hits('✘ Ошибка', 'checkmarks'));
    assert.ok(hits('❌ Нет', 'checkmarks'));
    assert.ok(hits('☑ Выбрано', 'checkmarks'));
  });

  it('passes plain text', () => {
    assert.ok(clean('- Сделано', 'checkmarks'));
    assert.ok(clean('* Выполнено', 'checkmarks'));
    assert.ok(clean('x Ошибка', 'checkmarks'));
  });
});

// ─────────────────────────────────────────
// ANGLICISMS
// ─────────────────────────────────────────

describe('anglicisms', () => {
  it('catches tech anglicisms', () => {
    assert.ok(hits('Нужно имплементировать эту функцию.', 'anglicisms'));
    assert.ok(hits('Деплой прошёл успешно.', 'anglicisms'));
    assert.ok(hits('Апдейт системы завершён.', 'anglicisms'));
    assert.ok(hits('Нужен рефакторинг кода.', 'anglicisms'));
    assert.ok(hits('Кастомный компонент.', 'anglicisms'));
    assert.ok(hits('Трекинг событий.', 'anglicisms'));
    assert.ok(hits('Фидбек от пользователей.', 'anglicisms'));
    assert.ok(hits('Пайплайн сборки.', 'anglicisms'));
    assert.ok(hits('Стейкхолдеры проекта.', 'anglicisms'));
    assert.ok(hits('Онбординг нового сотрудника.', 'anglicisms'));
    assert.ok(hits('Перформанс системы низкий.', 'anglicisms'));
    assert.ok(hits('Бэклог задач.', 'anglicisms'));
    assert.ok(hits('Новый релиз продукта.', 'anglicisms'));
    assert.ok(hits('Крутая фича продукта.', 'anglicisms'));
    assert.ok(hits('Хайп вокруг нейросетей.', 'anglicisms'));
    assert.ok(hits('Юзеры жалуются.', 'anglicisms'));
    assert.ok(hits('Это факап проекта.', 'anglicisms'));
    assert.ok(hits('Митинг в 15:00.', 'anglicisms'));
    assert.ok(hits('Дедлайн — пятница.', 'anglicisms'));
    assert.ok(hits('Интересный кейс.', 'anglicisms'));
    assert.ok(hits('Инсайт недели.', 'anglicisms'));
    assert.ok(hits('Питч для инвесторов.', 'anglicisms'));
  });

  it('catches translation calques', () => {
    assert.ok(hits('Принять на борт это решение.', 'anglicisms'));
    assert.ok(hits('Болевых точек слишком много.', 'anglicisms'));
  });

  it('passes legitimate Russian text', () => {
    assert.ok(clean('Реализовать функцию.', 'anglicisms'));
    assert.ok(clean('Развёртывание прошло успешно.', 'anglicisms'));
    assert.ok(clean('Обновление системы завершено.', 'anglicisms'));
    assert.ok(clean('Обратная связь от пользователей.', 'anglicisms'));
    assert.ok(clean('Пользователи жалуются.', 'anglicisms'));
    assert.ok(clean('Совещание в 15:00.', 'anglicisms'));
    assert.ok(clean('Крайний срок — пятница.', 'anglicisms'));
  });

  it('inflected forms are caught', () => {
    assert.ok(hits('Мы задеплоили сервис.', 'anglicisms'));
    assert.ok(hits('Требуется имплементация.', 'anglicisms'));
    assert.ok(hits('Кастомизированный интерфейс.', 'anglicisms'));
    assert.ok(hits('Деплоить нужно осторожно.', 'anglicisms'));
  });
});

// ─────────────────────────────────────────
// VERBALIZATION-ANNOUNCE
// ─────────────────────────────────────────

describe('verbalization-announce', () => {
  it('catches meta-announcements', () => {
    assert.ok(hits('Сейчас расскажу о структуре.', 'verbalization-announce'));
    assert.ok(hits('Сейчас объясню, как это работает.', 'verbalization-announce'));
    assert.ok(hits('Позвольте объяснить принцип.', 'verbalization-announce'));
    assert.ok(hits('Попробую объяснить проще.', 'verbalization-announce'));
    assert.ok(hits('Постараюсь ответить подробно.', 'verbalization-announce'));
    assert.ok(hits('Начнём с основ.', 'verbalization-announce'));
    assert.ok(hits('Начну с контекста.', 'verbalization-announce'));
    assert.ok(hits('Я расскажу о каждом пункте.', 'verbalization-announce'));
    assert.ok(hits('Я объясню каждый шаг.', 'verbalization-announce'));
    assert.ok(hits('Хочу рассказать об этом подробнее.', 'verbalization-announce'));
    assert.ok(hits('Представляю вашему вниманию список.', 'verbalization-announce'));
    assert.ok(hits('Предлагаю вашему вниманию подборку.', 'verbalization-announce'));
  });

  it('passes direct content', () => {
    assert.ok(clean('Структура такова: X, Y, Z.', 'verbalization-announce'));
    assert.ok(clean('Принцип работы — цикл обратной связи.', 'verbalization-announce'));
    assert.ok(clean('Это работает следующим образом.', 'verbalization-announce'));
  });
});

// ─────────────────────────────────────────
// VERBALIZATION-POINTER
// ─────────────────────────────────────────

describe('verbalization-pointer', () => {
  it('catches pointer fillers', () => {
    assert.ok(hits('Ниже приведён список.', 'verbalization-pointer'));
    assert.ok(hits('Ниже представлена таблица.', 'verbalization-pointer'));
    assert.ok(hits('Ниже перечислены требования.', 'verbalization-pointer'));
    assert.ok(hits('Вот что вам нужно знать.', 'verbalization-pointer'));
    assert.ok(hits('Вот несколько примеров.', 'verbalization-pointer'));
    assert.ok(hits('Давайте рассмотрим подробнее.', 'verbalization-pointer'));
    assert.ok(hits('Давайте разберём каждый пункт.', 'verbalization-pointer'));
    assert.ok(hits('Рассмотрим подробнее каждый раздел.', 'verbalization-pointer'));
    assert.ok(hits('Перейдём к следующему разделу.', 'verbalization-pointer'));
  });

  it('passes direct references', () => {
    assert.ok(clean('Список из трёх пунктов:', 'verbalization-pointer'));
    assert.ok(clean('Таблица 1: Сравнение методов.', 'verbalization-pointer'));
  });
});

// ─────────────────────────────────────────
// REQUEST-PARAPHRASE
// ─────────────────────────────────────────

describe('request-paraphrase', () => {
  it('catches request paraphrasing', () => {
    assert.ok(hits('Вы просили рассказать о нейросетях.', 'request-paraphrase'));
    assert.ok(hits('Как вы и просили, привожу список.', 'request-paraphrase'));
    assert.ok(hits('В вашем вопросе затронута тема.', 'request-paraphrase'));
    assert.ok(hits('Судя по вашему вопросу, вас интересует.', 'request-paraphrase'));
    assert.ok(hits('Вы хотите знать о разнице между X и Y.', 'request-paraphrase'));
    assert.ok(hits('По вашей просьбе составил список.', 'request-paraphrase'));
    assert.ok(hits('Исходя из вашего запроса, рассмотрим.', 'request-paraphrase'));
  });

  it('passes direct answers', () => {
    assert.ok(clean('Разница между X и Y — в подходе.', 'request-paraphrase'));
    assert.ok(clean('Список: A, B, C.', 'request-paraphrase'));
  });
});

// ─────────────────────────────────────────
// SELF-PRAISE
// ─────────────────────────────────────────

describe('self-praise', () => {
  it('catches self-praise and question flattery', () => {
    assert.ok(hits('Отличный вопрос!', 'self-praise'));
    assert.ok(hits('Прекрасный вопрос, отвечаю.', 'self-praise'));
    assert.ok(hits('Замечательная тема!', 'self-praise'));
    assert.ok(hits('Интересный вопрос.', 'self-praise'));
    assert.ok(hits('Глубокий анализ позволяет...', 'self-praise'));
    assert.ok(hits('Исчерпывающий ответ на ваш вопрос.', 'self-praise'));
    assert.ok(hits('Полное руководство по теме.', 'self-praise'));
    assert.ok(hits('Лучшая подборка инструментов.', 'self-praise'));
    assert.ok(hits('Подробный разбор ситуации.', 'self-praise'));
    assert.ok(hits('Детальный анализ данных.', 'self-praise'));
  });

  it('passes neutral descriptions', () => {
    assert.ok(clean('Это сложный вопрос.', 'self-praise'));
    assert.ok(clean('Краткий список.', 'self-praise'));
  });
});

// ─────────────────────────────────────────
// ENTHUSIASM
// ─────────────────────────────────────────

describe('enthusiasm', () => {
  it('catches enthusiastic openers', () => {
    assert.ok(hits('Конечно! Рассмотрим эту тему.', 'enthusiasm'));
    assert.ok(hits('Безусловно! Вот ответ.', 'enthusiasm'));
    assert.ok(hits('Разумеется! Сейчас объясню.', 'enthusiasm'));
    assert.ok(hits('Отлично! Начинаем.', 'enthusiasm'));
    assert.ok(hits('Прекрасно! Рад помочь.', 'enthusiasm'));
    assert.ok(hits('Замечательно! Перейдём к теме.', 'enthusiasm'));
    assert.ok(hits('Великолепно! Вот ваш ответ.', 'enthusiasm'));
    assert.ok(hits('С удовольствием! Объясняю.', 'enthusiasm'));
    assert.ok(hits('Рад помочь! Вот что нужно.', 'enthusiasm'));
    assert.ok(hits('Удачи!', 'enthusiasm'));
    assert.ok(hits('Успехов!', 'enthusiasm'));
  });

  it('passes calm, neutral tone', () => {
    assert.ok(clean('Рассмотрим три подхода.', 'enthusiasm'));
    assert.ok(clean('Ответ зависит от контекста.', 'enthusiasm'));
    assert.ok(clean('Конечно, если учесть контекст...', 'enthusiasm')); // no exclamation
  });
});

// ─────────────────────────────────────────
// SIGNIFICANCE-EXAGGERATION
// ─────────────────────────────────────────

describe('significance-exaggeration', () => {
  it('catches significance exaggeration', () => {
    assert.ok(hits('Это критически важный момент.', 'significance-exaggeration'));
    assert.ok(hits('Принципиально важное отличие.', 'significance-exaggeration'));
    assert.ok(hits('Революционный подход к задаче.', 'significance-exaggeration'));
    assert.ok(hits('Кардинальное изменение подхода.', 'significance-exaggeration'));
    assert.ok(hits('Это коренным образом меняет дело.', 'significance-exaggeration'));
    assert.ok(hits('Фундаментальная разница между ними.', 'significance-exaggeration'));
    assert.ok(hits('Качественно другой подход.', 'significance-exaggeration'));
    assert.ok(hits('Качественный скачок в понимании.', 'significance-exaggeration'));
    assert.ok(hits('Смена парадигмы в разработке.', 'significance-exaggeration'));
    assert.ok(hits('Огромная разница в подходах.', 'significance-exaggeration'));
  });

  it('passes proportionate language', () => {
    assert.ok(clean('Есть различие в подходах.', 'significance-exaggeration'));
    assert.ok(clean('Другой метод решения.', 'significance-exaggeration'));
  });
});

// ─────────────────────────────────────────
// CONTRAST-A — главный приоритет
// ─────────────────────────────────────────

describe('contrast-a', () => {
  it('catches «не X, а Y» pattern', () => {
    assert.ok(hits('Это не инструмент, а экосистема.', 'contrast-a'));
    assert.ok(hits('Не баг, а фича.', 'contrast-a'));
    assert.ok(hits('Речь идёт не о цене, а о ценности.', 'contrast-a'));
    assert.ok(hits('Здесь не совпадение, а закономерность.', 'contrast-a'));
  });

  it('catches «не просто X, а Y»', () => {
    assert.ok(hits('Это не просто инструмент, а целая экосистема.', 'contrast-a'));
    assert.ok(hits('Не просто красиво, а функционально.', 'contrast-a'));
  });

  it('catches «это не X — это Y»', () => {
    assert.ok(hits('Это не баг — это фича.', 'contrast-a'));
    assert.ok(hits('Это не ошибка — это возможность.', 'contrast-a'));
  });

  it('catches balance clichés', () => {
    assert.ok(hits('С одной стороны, быстро.', 'contrast-a'));
    assert.ok(hits('С другой стороны, дорого.', 'contrast-a'));
    assert.ok(hits('Он не только умный, но и опытный.', 'contrast-a'));
    assert.ok(hits('Тогда как конкуренты проигрывают.', 'contrast-a'));
    assert.ok(hits('В то время как другие ждут.', 'contrast-a'));
    assert.ok(hits('В отличие от классического подхода.', 'contrast-a'));
    assert.ok(hits('Если раньше это было сложно, то теперь.', 'contrast-a'));
    assert.ok(hits('Вместо того чтобы ждать, действуй.', 'contrast-a'));
    assert.ok(hits('Диаметрально противоположный взгляд.', 'contrast-a'));
    assert.ok(hits('Не столько скорость, сколько точность.', 'contrast-a'));
  });

  it('catches «речь идёт не о X, а о Y»', () => {
    assert.ok(hits('Речь идёт не о деньгах, а о принципах.', 'contrast-a'));
    assert.ok(hits('Мы имеем дело не с ошибкой, а с паттерном.', 'contrast-a'));
    assert.ok(hits('Перед нами не задача, а вызов.', 'contrast-a'));
  });
});

// ─────────────────────────────────────────
// CONCEPT-REPACKAGING
// ─────────────────────────────────────────

describe('concept-repackaging', () => {
  it('catches concept repackaging', () => {
    assert.ok(hits('Это уже не просто утилита, а полноценная платформа.', 'concept-repackaging'));
    assert.ok(hits('Это не просто текст — это послание.', 'concept-repackaging'));
    assert.ok(hits('Речь идёт уже не о скорости, а о надёжности.', 'concept-repackaging'));
    assert.ok(hits('Это не что иное, как революция.', 'concept-repackaging'));
    assert.ok(hits('Иными словами, это просто loop.', 'concept-repackaging'));
    assert.ok(hits('Другими словами, это обычный баг.', 'concept-repackaging'));
  });

  it('passes genuine restatements', () => {
    assert.ok(clean('Это называется рекурсия.', 'concept-repackaging'));
  });
});

// ─────────────────────────────────────────
// CORRECTING-USER
// ─────────────────────────────────────────

describe('correcting-user', () => {
  it('catches user correction patterns', () => {
    assert.ok(hits('Вы имели в виду функцию?', 'correcting-user'));
    assert.ok(hits('Точнее будет сказать «метод».', 'correcting-user'));
    assert.ok(hits('Правильнее говорить «интерфейс».', 'correcting-user'));
    assert.ok(hits('Корректнее называть это «шаблоном».', 'correcting-user'));
    assert.ok(hits('Формально это называется делегированием.', 'correcting-user'));
    assert.ok(hits('Точнее говоря, это не ошибка.', 'correcting-user'));
    assert.ok(hits('Если быть точным, то разница есть.', 'correcting-user'));
    assert.ok(hits('Строго говоря, это неверно.', 'correcting-user'));
    assert.ok(hits('Технически, это не так работает.', 'correcting-user'));
  });

  it('passes neutral factual statements', () => {
    assert.ok(clean('Функция возвращает массив.', 'correcting-user'));
    assert.ok(clean('Метод принимает два аргумента.', 'correcting-user'));
  });
});

// ─────────────────────────────────────────
// STATING-OBVIOUS
// ─────────────────────────────────────────

describe('stating-obvious', () => {
  it('catches condescension and obvious-stating', () => {
    assert.ok(hits('Как вы наверное знаете, HTTP — протокол.', 'stating-obvious'));
    assert.ok(hits('Как всем известно, земля круглая.', 'stating-obvious'));
    assert.ok(hits('Очевидно, что нужно тестировать код.', 'stating-obvious'));
    assert.ok(hits('Само собой разумеется, это важно.', 'stating-obvious'));
    assert.ok(hits('Не секрет, что Python популярен.', 'stating-obvious'));
    assert.ok(hits('Напомним, что переменные нужно называть.', 'stating-obvious'));
    assert.ok(hits('Важно понимать, что это основа.', 'stating-obvious'));
    assert.ok(hits('Следует отметить, что это норма.', 'stating-obvious'));
    assert.ok(hits('Необходимо понимать, что контекст важен.', 'stating-obvious'));
    assert.ok(hits('Хотелось бы отметить важность тестов.', 'stating-obvious'));
    assert.ok(hits('Стоит отметить, что это часто встречается.', 'stating-obvious'));
    assert.ok(hits('Позволю себе напомнить об этом.', 'stating-obvious'));
  });

  it('passes direct, non-patronising statements', () => {
    assert.ok(clean('HTTP — протокол прикладного уровня.', 'stating-obvious'));
    assert.ok(clean('Python популярен в дата-сайенс.', 'stating-obvious'));
  });
});

// ─────────────────────────────────────────
// TEXT-INFLATION
// ─────────────────────────────────────────

describe('text-inflation', () => {
  it('catches filler phrases', () => {
    assert.ok(hits('В данном контексте это важно.', 'text-inflation'));
    assert.ok(hits('В рамках данного проекта.', 'text-inflation'));
    assert.ok(hits('На данном этапе разработки.', 'text-inflation'));
    assert.ok(hits('Данный вопрос требует внимания.', 'text-inflation'));
    assert.ok(hits('Следует отметить этот момент.', 'text-inflation'));
    assert.ok(hits('Необходимо подчеркнуть важность.', 'text-inflation'));
    assert.ok(hits('Обратите внимание на детали.', 'text-inflation'));
    assert.ok(hits('Примечательно, что это работает.', 'text-inflation'));
    assert.ok(hits('Показательно, что метрики выросли.', 'text-inflation'));
    assert.ok(hits('В целом можно сказать, что всё хорошо.', 'text-inflation'));
    assert.ok(hits('Подводя итог, отметим главное.', 'text-inflation'));
    assert.ok(hits('В заключение следует сказать.', 'text-inflation'));
    assert.ok(hits('Таким образом, получаем ответ.', 'text-inflation'));
    assert.ok(hits('Итак, перейдём к делу.', 'text-inflation'));
    assert.ok(hits('Резюмируя вышесказанное.', 'text-inflation'));
    assert.ok(hits('Помимо этого, стоит добавить.', 'text-inflation'));
    assert.ok(hits('Более того, это подтверждается.', 'text-inflation'));
    assert.ok(hits('Что немаловажно, результат стабилен.', 'text-inflation'));
    assert.ok(hits('Надо сказать, что это работает.', 'text-inflation'));
  });

  it('passes lean, direct sentences', () => {
    assert.ok(clean('Результат стабилен.', 'text-inflation'));
    assert.ok(clean('Три подхода к решению:', 'text-inflation'));
  });
});

// ─────────────────────────────────────────
// END-OFFERS
// ─────────────────────────────────────────

describe('end-offers', () => {
  it('catches end-of-response offer patterns', () => {
    assert.ok(hits('Могу также добавить примеры.', 'end-offers'));
    assert.ok(hits('Могу дополнительно объяснить.', 'end-offers'));
    assert.ok(hits('Если нужно, могу расширить.', 'end-offers'));
    assert.ok(hits('Если вам нужна информация, могу найти.', 'end-offers'));
    assert.ok(hits('Если есть вопросы — пишите.', 'end-offers'));
    assert.ok(hits('Не стесняйтесь спрашивать.', 'end-offers'));
    assert.ok(hits('Обращайтесь если что-то непонятно.', 'end-offers'));
    assert.ok(hits('Давайте я для вас составлю список.', 'end-offers'));
    assert.ok(hits('Готов помочь с любым вопросом.', 'end-offers'));
    assert.ok(hits('Если нужна дополнительная информация.', 'end-offers'));
    assert.ok(hits('Если есть ещё вопросы — спрашивайте.', 'end-offers'));
    assert.ok(hits('Могу поискать ещё примеры.', 'end-offers'));
    assert.ok(hits('Надеюсь, это помогло!', 'end-offers'));
    assert.ok(hits('Надеюсь, что помог разобраться.', 'end-offers'));
  });

  it('passes direct content without offers', () => {
    assert.ok(clean('Список: A, B, C.', 'end-offers'));
    assert.ok(clean('Ответ: да.', 'end-offers'));
    assert.ok(clean('Функция принимает два аргумента.', 'end-offers'));
  });
});

// ─────────────────────────────────────────
// LINTER MECHANICS
// ─────────────────────────────────────────

describe('linter mechanics', () => {
  it('returns correct line number', () => {
    const text = 'Первая строка.\nОтличный вопрос!\nТретья строка.';
    const result = lint(text, rules).filter(f => f.ruleId === 'self-praise');
    assert.ok(result.length > 0);
    assert.equal(result[0].line, 2);
  });

  it('returns correct column', () => {
    const text = 'Вот что нужно знать.';
    const result = lint(text, rules).filter(f => f.ruleId === 'verbalization-pointer');
    assert.ok(result.length > 0);
    assert.equal(result[0].col, 1);
  });

  it('deduplicates identical findings', () => {
    const text = 'Не просто инструмент, а экосистема.';
    const result = lint(text, rules).filter(f => f.ruleId === 'contrast-a');
    const positions = result.map(f => `${f.line}:${f.col}`);
    const unique = new Set(positions);
    assert.equal(positions.length, unique.size);
  });

  it('multiple rules fire on same text', () => {
    const text = 'Отличный вопрос! 🎉 Сейчас расскажу.';
    const result = lint(text, rules);
    const ruleIds = new Set(result.map(f => f.ruleId));
    assert.ok(ruleIds.has('self-praise'));
    assert.ok(ruleIds.has('emoji'));
    assert.ok(ruleIds.has('verbalization-announce'));
  });
});

// ─────────────────────────────────────────
// CONFIG EXTENSION
// ─────────────────────────────────────────

describe('applyConfig', () => {
  it('extends existing rule with new pattern', () => {
    const customRules = applyConfig(rules, {
      extendRules: {
        // Cyrillic — no \b, use lookbehind-style boundary
        anglicisms: [{ regex: '/(?<![а-яёА-ЯЁ])оупенсорс[а-яё]*/gi', message: 'опенсорс → открытый код' }],
      },
    });
    const result = lint('Оупенсорс проект.', customRules).filter(f => f.ruleId === 'anglicisms');
    assert.ok(result.length > 0);
    assert.ok(result.some(f => f.message.includes('открытый код')));
  });

  it('adds completely new rule', () => {
    const customRules = applyConfig(rules, {
      addRules: [{
        id: 'test-custom',
        name: 'Тест',
        severity: 'warning',
        // No \b for Cyrillic — use lookahead boundary
        patterns: [{ regex: '/тест-маркер(?![а-яёА-ЯЁ])/gi', message: 'кастомный паттерн' }],
      }],
    });
    const result = lint('Это тест-маркер конца.', customRules).filter(f => f.ruleId === 'test-custom');
    assert.ok(result.length > 0);
  });

  it('disables a rule', () => {
    const customRules = applyConfig(rules, {
      disableRules: ['emoji'],
    });
    const result = lint('Привет 🎉', customRules).filter(f => f.ruleId === 'emoji');
    assert.equal(result.length, 0);
  });
});

// ─────────────────────────────────────────
// REAL-WORLD LLM TEXT SAMPLES
// ─────────────────────────────────────────

describe('real-world LLM texts', () => {
  const llmResponse1 = `
Отличный вопрос! Сейчас расскажу обо всём подробно.

Как вы, наверное, знаете, эта тема очень важна. Следует отметить, что в данном контексте
мы имеем дело не с простым вопросом, а с фундаментальной проблемой.

С одной стороны, подход A хорош. С другой стороны, подход B лучше. В отличие от первого,
второй является революционным. Это уже не просто утилита, а целая экосистема решений.

Если есть ещё вопросы — не стесняйтесь спрашивать. Надеюсь, это помогло! 😊
  `.trim();

  it('catches many patterns in typical LLM response', () => {
    const result = lint(llmResponse1, rules);
    const ruleIds = new Set(result.map(f => f.ruleId));

    assert.ok(ruleIds.has('self-praise'), 'should catch self-praise');
    assert.ok(ruleIds.has('verbalization-announce'), 'should catch announce');
    assert.ok(ruleIds.has('stating-obvious'), 'should catch obvious-stating');
    assert.ok(ruleIds.has('text-inflation'), 'should catch filler');
    assert.ok(ruleIds.has('contrast-a'), 'should catch contrast');
    assert.ok(ruleIds.has('concept-repackaging'), 'should catch repackaging');
    assert.ok(ruleIds.has('end-offers'), 'should catch end-offers');
    assert.ok(ruleIds.has('emoji'), 'should catch emoji');
    assert.ok(result.length >= 8, `expected 8+ findings, got ${result.length}`);
  });

  const cleanText = `
Три подхода к задаче: X, Y, Z.

Подход X быстрее, Y — надёжнее, Z — дешевле. Выбор зависит от требований проекта.

Пример кода:
\`\`\`
const result = compute(data);
\`\`\`
  `.trim();

  it('produces no findings on clean text', () => {
    const result = lint(cleanText, rules);
    assert.equal(result.length, 0, `expected 0 findings, got: ${result.map(f => f.ruleId + ':' + f.message).join(', ')}`);
  });
});
