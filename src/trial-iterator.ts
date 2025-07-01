export abstract class TrialIterator<T> {
  [Symbol.iterator]() {
    return this;
  }
  abstract next(): IteratorResult<T, void>;
}
//TODO: implement
export class RandomSampling<T> extends TrialIterator<T> {}

export abstract class ResponsedTrialIterator<T, U> extends TrialIterator<T> {
  abstract response(value: U): void;
}
export class StairCase extends ResponsedTrialIterator<number, boolean> {
  data: { value: number; response: boolean; isReversal: boolean }[] = [];
  #hasDone = false;
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
  next(): IteratorResult<number, void> {
    if (this.#hasDone) {
      return { value: void 0, done: true };
    }
    const nTrials = this.data.length;
    if (nTrials === 0) {
      // first trial
      const value = this.opts.startVal;
      this.data.push({ value, response: false, isReversal: false });
      return { value, done: false };
    }
    const nReversals = this.data.filter((e) => e.isReversal).length;
    if (nReversals >= this.opts.nReversals) {
      // done
      this.#hasDone = true;
      return { value: void 0, done: true };
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
    return { value, done: false };
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
  /**@param nReversals number of reversals to consider */
  getThreshold(nReversals = this.opts.nReversals) {
    const valids = this.data.filter((e) => e.isReversal).slice(-nReversals);
    if (valids.length < nReversals) {
      throw new Error('Not enough reversals');
    }
    return valids.reduce((acc, e) => acc + e.value, 0) / valids.length;
  }
}
