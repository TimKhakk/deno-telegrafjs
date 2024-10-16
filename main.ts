import "jsr:@std/dotenv/load";
import schedule from 'node-schedule';
import { type Context, Telegraf, session } from 'telegraf';
import { FmtString } from 'telegraf/format';

console.log('Bot is working...');

const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');

if (TOKEN == null) {
  throw new TypeError('TELEGRAM_BOT_TOKEN must be provided!');
}

interface SessionData {
  messageCount: number;
  taskState: {
    done: boolean;
    updatedAt: Date | null;
  };
}

interface LocalContext extends Context {
  session?: SessionData;
}

const bot = new Telegraf<LocalContext>(TOKEN);

bot.use(session());

const CALLBACK_DATA_IDS = {
  TaskAlreadyDone: 'done-button-clicked',
} as const;

const text = '⚠️ Пора сдать показания счетчиков!';
const startText =
  'Привет! Каждый день начиная с 15 числа месяца и в течении 10 дней, я буду напоминать тебе о том, что нужно сдать показания счетчиков';
const textAlt = '⚠️ Счетчики ждут!';
const siteText = 'Сайт Личного Кабинета';
const doneText = '✅ Уже сдал(а)';
const websiteUrl = 'https://cabinet.rc-online.ru/sign_in';
let remindersEnabled = true;
let taskDoneThisMonth = false;

// Helper function to get the current date information
const getCurrentDateInfo = () => {
  const now = new Date();
  return {
    day: now.getDate(),
    month: now.getMonth() + 1, // Month is zero-indexed
    year: now.getFullYear(),
  };
};

// Function to reset taskDoneThisMonth flag on the 1st of each month
const resetMonthlyTask = () => {
  const { day } = getCurrentDateInfo();
  if (day === 1) {
    taskDoneThisMonth = false;
    remindersEnabled = true;
  }
};

// Schedule the taskDoneThisMonth reset to run daily at midnight
schedule.scheduleJob('0 0 * * *', () => {
  resetMonthlyTask();
});

// Function to handle reminders between the 15th and 25th of each month
const scheduleReminders = (cb: VoidFunction) => {
  const rule = new schedule.RecurrenceRule();
  rule.hour = 10; // Set time (10:00 AM)
  rule.minute = 0; // Set the exact minute

  schedule.scheduleJob(rule, () => {
    const { day } = getCurrentDateInfo();

    if (day >= 15 && day <= 25 && remindersEnabled && !taskDoneThisMonth) {
      cb();
    }
  });
};
const doneCommand = (ctx: { reply: (text: string) => void }) => {
  if (!taskDoneThisMonth) {
    taskDoneThisMonth = true;
    remindersEnabled = false;
    ctx.reply('✅ Отлично! Увидимся в следующем месяце!');
  } else {
    ctx.reply('✅ Показания счетчиков уже сданы. Успокойся!');
  }
};
const undoneCommand = (ctx: { reply: (text: string) => void }) => {
  if (taskDoneThisMonth) {
    taskDoneThisMonth = false;
    remindersEnabled = true;
    ctx.reply(text);
  } else {
    ctx.reply(text);
  }
};

bot.start((ctx) => {
  const cb = () => {
    ctx.reply(new FmtString(text), {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: siteText,
              url: websiteUrl,
            },
            {
              text: doneText,
              callback_data: CALLBACK_DATA_IDS.TaskAlreadyDone,
            },
          ],
        ],
      },
    });
  };
  scheduleReminders(cb);
  ctx.reply(startText);
});
// Command to get the current status of the task
bot.command('status', (ctx) => {
  const statusMessage = taskDoneThisMonth
    ? '✅ Показания счетчиков на этот месяц уже сданы.'
    : textAlt;

  ctx.reply(statusMessage);
});

bot.command('done', doneCommand);
bot.command('undone', undoneCommand);

bot.on('callback_query', (ctx) => {
  switch (ctx.callbackQuery.data) {
    case CALLBACK_DATA_IDS.TaskAlreadyDone: {
      doneCommand(ctx);

      break;
    }

    default: {
      console.log('Unknown callback query');
    }
  }
});

bot.launch();
