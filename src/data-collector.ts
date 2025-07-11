import { h } from './util';

// stringifiers
export abstract class DataStringifier {
  value = '';
  /** Transform a data object into a string chunk, and append it to the collector */
  abstract transform(data: Data): string;
  /** Create the final chunk, and append it to the collector */
  abstract final(): string;
}
export class CSVStringifier extends DataStringifier {
  keys: string[] = [];
  transform(data: Data) {
    let chunk = '';
    if (this.keys.length === 0) {
      this.keys = Object.keys(data);
      chunk = this.keys.reduce(
        (acc, key) => acc + (key.includes(',') ? `"${key}"` : key) + ',',
        '',
      );
    }
    chunk += this.keys.reduce((acc, key) => {
      const value = data[key];
      return acc + (('' + value).includes(',') ? `"${value}"` : value) + ',';
    }, '\n');
    this.value += chunk;
    return chunk;
  }
  final() {
    return '';
  }
}
export class JSONStringifier extends DataStringifier {
  transform(data: Data) {
    const chunk = (this.value === '' ? '[' : ',') + JSON.stringify(data);
    this.value += chunk;
    return chunk;
  }
  final() {
    this.value += ']';
    return ']';
  }
}

// collector
export class DataCollector<T extends Data> {
  rows: T[] = [];
  stringifier: DataStringifier;
  stream?: FileSystemWritableFileStream;
  #saved = false;
  /**
   * A map of stringifier classes by file extension
   *
   * You can add your own stringifier class to this map. The class should extend
   * `DataStringifier` and implement `transform` and `final` methods. The key is
   * the file extension (without the dot), and the value is the class.
   *
   * @example
   *   // add support for Markdown files, whose extension is 'md'
   *   DataCollector.stringifiers['md'] = class extends DataStringifier {
   *     transform(data) {
   *       // write transform logic here
   *       return '';
   *     }
   *     final() {
   *       // write final logic here
   *       return '';
   *     }
   *   };
   */
  static readonly stringifiers: Record<string, new () => DataStringifier> = {
    csv: CSVStringifier,
    json: JSONStringifier,
  };
  /**
   * @example
   *   const dc = new DataCollector('data.csv');
   *   dc.add({ name: 'Alice', age: 25 });
   *   dc.add({ name: 'Bob', age: 30 });
   *   await dc.save();
   */
  constructor(
    public filename = `data-${Date.now()}.csv`,
    stringifier?: DataStringifier,
  ) {
    // set stringifier
    const match = filename.match(/\.([^\.]+)$/);
    const defaultExt = 'csv';
    const extname = match
      ? match[1]
      : (console.warn('Please specify the file extension in the filename'),
        defaultExt);
    if (stringifier instanceof DataStringifier) {
      this.stringifier = stringifier;
    } else {
      const extnames = Object.keys(DataCollector.stringifiers);
      if (extnames.includes(extname)) {
        this.stringifier = new DataCollector.stringifiers[extname]();
      } else {
        console.warn(
          `Please specify a valid file extension: ${extnames.join(
            ', ',
          )}, but got "${extname}".\nOr, add your DataStringifier class to DataCollector.stringifiers.`,
        );
        this.stringifier = new DataCollector.stringifiers[defaultExt]();
      }
    }
    // backup when the page is hidden.
    // TODO: this is unnecessary if it has a stream
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.backup();
        alert(
          'Please keep the page visible on the screen during the data collection',
        );
      }
    });
  }
  /**
   * Write data to disk using a writable stream.
   *
   * @example
   *   const dir = await window.showDirectoryPicker();
   *   const dc = await new DataCollector('data.csv').withStream(dir);
   */
  async withStream(dir?: FileSystemDirectoryHandle) {
    if (typeof window.showSaveFilePicker === 'function') {
      const file = dir
        ? await dir.getFileHandle(this.filename, { create: true })
        : await window.showSaveFilePicker({ suggestedName: this.filename });
      this.stream = await file.createWritable();
    }
    return this;
  }
  /**
   * Add a row
   *
   * @returns The string chunk that was recorded
   */
  async add(row: T) {
    this.rows.push(row);
    const chunk = this.stringifier.transform(row);
    await this.stream?.write(chunk);
    return chunk;
  }
  /** Download current data to disk */
  backup(suffix = '.backup') {
    const url = URL.createObjectURL(
      new Blob([this.stringifier.value], { type: 'text/plain' }),
    );
    const el = h('a', { download: this.filename + suffix, href: url });
    document.body.appendChild(el);
    el.click();
    document.body.removeChild(el);
    URL.revokeObjectURL(url);
  }
  /** Write final data to disk */
  async save() {
    if (this.#saved) {
      console.warn('Repeated save is not allowed');
      return;
    }
    const chunk = this.stringifier.final();
    if (this.stream) {
      await this.stream.write(chunk);
      await this.stream.close();
    } else {
      this.backup('');
    }
    this.#saved = true;
  }
}
