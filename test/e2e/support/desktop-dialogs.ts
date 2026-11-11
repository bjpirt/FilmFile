import { app, BaseWindow, dialog, session, shell } from 'electron';

// Loaded into the desktop app by its journeys (`-r`, as Playwright loads its
// own), before the app itself: answers the system's dialogs as a person
// would, in turn, from FILMFILE_TEST_DIALOGS (`{ "choose": folder }` in a
// folder picker, `{ "cancel": true }` to cancel one, `{ "button": label }` in
// a message, `{ "save": path }` to save a download there or `{ "cancel": true }`
// to cancel it), and keeps what each said in `dialogsShown` for the journey to
// read. Doesn't open anything for real: the paths the app asks the system to
// open (Show FilmFile Folder in Finder) are kept in `pathsOpened`. Also keeps
// the app's settings in FILMFILE_TEST_USER_DATA, not the real ones.

interface Answer {
  readonly choose?: string;
  readonly cancel?: boolean;
  readonly button?: string;
  readonly save?: string;
}

const answers: Answer[] = parseAnswers(process.env.FILMFILE_TEST_DIALOGS);
const shown: object[] = [];
Reflect.set(globalThis, 'dialogsShown', shown);
const opened: string[] = [];
const shownInFolder: string[] = [];
Reflect.set(globalThis, 'pathsShownInFolder', shownInFolder);
Reflect.set(globalThis, 'pathsOpened', opened);

shell.openPath = (path: string) => {
  opened.push(path);
  return Promise.resolve('');
};

shell.showItemInFolder = (path: string) => {
  shownInFolder.push(path);
};

// A download's save dialog is the system's own, which can't be answered from
// here: the answer sets the path in its place, and where the dialog would have
// started is kept, for the journey to read.
void app.whenReady().then(() => {
  session.defaultSession.on('will-download', (_event, item) => {
    const save = answers.shift()?.save;
    if (save === undefined) {
      item.cancel();
    } else {
      item.setSavePath(save);
    }
    // After the app's own listener has said where its dialog would start.
    setTimeout(() => {
      shown.push({
        saveDialog: { defaultPath: item.getSaveDialogOptions().defaultPath },
      });
    }, 0);
  });
});

const userData = process.env.FILMFILE_TEST_USER_DATA;
if (userData !== undefined) {
  app.setPath('userData', userData);
}

// Each takes an optional parent window first, then its options.
dialog.showOpenDialog = (
  first: BaseWindow | Electron.OpenDialogOptions,
  second?: Electron.OpenDialogOptions,
) => {
  const options = second ?? (first instanceof BaseWindow ? {} : first);
  shown.push({ title: options.title });
  const chosen = answers.shift()?.choose;
  return Promise.resolve(
    chosen === undefined
      ? { canceled: true, filePaths: [] }
      : { canceled: false, filePaths: [chosen] },
  );
};

dialog.showMessageBox = (
  first: BaseWindow | Electron.MessageBoxOptions,
  second?: Electron.MessageBoxOptions,
) => {
  const options =
    second ?? (first instanceof BaseWindow ? { message: '' } : first);
  shown.push({ message: options.message, detail: options.detail });
  const button = answers.shift()?.button ?? '';
  const response = (options.buttons ?? []).indexOf(button);
  return Promise.resolve({
    response: Math.max(response, 0),
    checkboxChecked: false,
  });
};

function parseAnswers(text: string | undefined): Answer[] {
  const parsed: unknown = JSON.parse(text ?? '[]');
  return Array.isArray(parsed)
    ? parsed.filter((answer): answer is Answer => typeof answer === 'object')
    : [];
}
