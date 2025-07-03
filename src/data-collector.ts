import { h } from './util';

// stringifiers
export abstract class DataStringifier {
  value = '';
  /**
   * transform a data object into a string chunk, and append it to the collector
   */
  abstract transform(data: Data): string;
  /**
   * create the final chunk, and append it to the collector
   */
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
  static readonly stringifiers = {
    csv: CSVStringifier,
    json: JSONStringifier,
  };
  /**
   * @example
   * const dc = new DataCollector('data.csv');
   * dc.add({ name: 'Alice', age: 25 });
   * dc.add({ name: 'Bob', age: 30 });
   * await dc.save();
   */
  constructor(
    /**@example 'data.csv' */
    public filename = `data-${Date.now()}.csv`,
    stringifier?: DataStringifier,
  ) {
    // save data on page exit
    window.addEventListener('beforeunload', async () => {
      await this.save();
    });
    // set stringifier
    const match = filename.match(/\.([^\.]+)$/);
    if (!match) {
      throw new Error('Cannot determine file extension from filename');
    }
    const extname = match[1];
    if (stringifier instanceof DataStringifier) {
      this.stringifier = stringifier;
    } else if (
      Object.prototype.hasOwnProperty.call(DataCollector.stringifiers, extname)
    ) {
      //@ts-ignore
      this.stringifier = new DataCollector.stringifiers[extname]();
    } else {
      throw new Error(`Unsupported file extension: ${extname}`);
    }
  }
  /**
   * @example
   * const dir = await window.showDirectoryPicker();
   * const dc = await DataCollector.create('data.csv').withStream(dir);
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
  async add(row: T) {
    this.rows.push(row);
    const chunk = this.stringifier.transform(row);
    await this.stream?.write(chunk).catch((err) => {
      console.error('Error writing to file', err);
    });
  }
  async save() {
    if (this.#saved) {
      return;
    }
    const chunk = this.stringifier.final();
    if (this.stream) {
      await this.stream.write(chunk);
      await this.stream.close();
    } else {
      const url = URL.createObjectURL(
        new Blob([this.stringifier.value], { type: 'text/plain' }),
      );
      const el = h('a', { download: this.filename, href: url });
      document.body.appendChild(el);
      el.click();
      document.body.removeChild(el);
      URL.revokeObjectURL(url);
    }
    this.#saved = true;
  }
}
