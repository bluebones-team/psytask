import * as csstype from 'csstype';

declare global {
  type Merge<T, U> = Omit<T, Extract<keyof T, keyof U>> & U;
  type MaybePromise<T> = T | Promise<T>;

  type LooseObject = { [key: string]: any };
  type Primitive = string | number | boolean | null | undefined;
  type Data = { [key: string]: Primitive };

  type HTMLElementEventType = keyof HTMLElementEventMap;
  type CSSProperties = csstype.Properties;

  type Benchmark = {
    except: number;
    value: number;
  };
  interface Window {
    /**log benchmark result */
    __benchmark__(datas: Benchmark[]): void;
  }
}
