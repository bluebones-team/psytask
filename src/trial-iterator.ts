export abstract class TrialIterator<T>
  extends Iterator<T, void>
  implements Iterable<T>
{
  readonly done = false;
  constructor() {
    super();
  }
  [Symbol.iterator]() {
    return this;
  }
  /**
   * Calculate the next value
   *
   * @returns Next value or `undefined` if the iterator is done
   */
  abstract nextValue(): T | void;
  next(): IteratorResult<T, void> {
    if (this.done) {
      return { value: void 0, done: true };
    }
    const value = this.nextValue();
    if (typeof value === 'undefined') {
      //@ts-ignore
      this.done = true;
      return { value: void 0, done: true };
    }
    return { value, done: false };
  }
}
export class RandomSampling<T> extends TrialIterator<T> {
  #count = 0;
  private opts: { candidates: T[]; sampleSize: number; replace: boolean };
  constructor(
    options: PartialByKeys<RandomSampling<T>['opts'], 'sampleSize' | 'replace'>,
  ) {
    super();
    this.opts = {
      candidates: options.candidates.slice(),
      sampleSize: options.sampleSize ?? options.candidates.length,
      replace: options.replace ?? true,
    };
    if (this.opts.candidates.length === 0) {
      throw new Error('Candidates cannot be empty');
    }
    if (this.opts.sampleSize <= 0) {
      throw new Error('Sample size must be > 0');
    }
    if (
      !this.opts.replace &&
      this.opts.sampleSize > this.opts.candidates.length
    ) {
      throw new Error(
        'Sample size must be <= the number of candidates when not replacing',
      );
    }
  }
  nextValue() {
    if (this.opts.candidates.length === 0) {
      return;
    }
    if (this.#count >= this.opts.sampleSize) {
      return;
    }
    this.#count++;
    // sample
    const idx = Math.floor(Math.random() * this.opts.candidates.length);
    if (!this.opts.replace) {
      this.opts.candidates.splice(idx, 1);
    }
    return this.opts.candidates[idx];
  }
}

export abstract class ResponsiveTrialIterator<T, R> extends TrialIterator<T> {
  abstract response(value: R): void;
}
export class StairCase extends ResponsiveTrialIterator<number, boolean> {
  data: { value: number; response: boolean; isReversal: boolean }[] = [];
  constructor(
    private opts: {
      startVal: number;
      step: number;
      nDown: number;
      nUp: number;
      nReversals: number;
      minVal?: number;
      maxVal?: number;
    },
  ) {
    super();
  }
  nextValue() {
    const nTrials = this.data.length;
    if (nTrials === 0) {
      // first trial
      const value = this.opts.startVal;
      this.data.push({ value, response: false, isReversal: false });
      return value;
    }
    const nReversals = this.data.filter((e) => e.isReversal).length;
    if (nReversals >= this.opts.nReversals) {
      return;
    }
    const prev = this.data.at(-1)!;
    let value = prev.value;
    if (nReversals === 0) {
      // before first reversal
      value += prev.response ? -this.opts.step : this.opts.step;
    } else {
      // after first reversal
      if (
        nTrials >= this.opts.nDown &&
        this.data
          .slice(-this.opts.nDown)
          .every((e) => e.value === value && e.response === true)
      ) {
        value -= this.opts.step;
      }
      if (
        nTrials >= this.opts.nUp &&
        this.data
          .slice(-this.opts.nUp)
          .every((e) => e.value === value && e.response === false)
      ) {
        value += this.opts.step;
      }
    }
    // clamp value
    if (typeof this.opts.minVal !== 'undefined' && value < this.opts.minVal) {
      value = this.opts.minVal;
    }
    if (typeof this.opts.maxVal !== 'undefined' && value > this.opts.maxVal) {
      value = this.opts.maxVal;
    }
    this.data.push({ value, response: false, isReversal: false });
    return value;
  }
  response(value: boolean) {
    if (this.data.length === 0) {
      throw new Error('No data');
    }
    const curr = this.data.at(-1)!;
    curr.response = value;
    if (this.data.length > 1) {
      const prev = this.data.at(-2)!;
      if (value !== prev.response) {
        curr.isReversal = true;
      }
    }
  }
  /** @param nReversals Number of reversals to consider */
  getThreshold(nReversals = this.opts.nReversals) {
    const valids = this.data.filter((e) => e.isReversal).slice(-nReversals);
    if (valids.length < nReversals) {
      throw new Error('Not enough reversals');
    }
    return valids.reduce((acc, e) => acc + e.value, 0) / valids.length;
  }
}
