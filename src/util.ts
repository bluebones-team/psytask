/**creates a new HTML element quickly and easily */
export function h<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  props: Partial<
    Merge<HTMLElementTagNameMap[K], { style?: CSSProperties }>
  > = {},
  children: string | Node | Node[] = [],
) {
  const el = document.createElement(tagName);
  for (const key in props) {
    if (props.hasOwnProperty(key)) {
      if (key === 'style') {
        for (const styleKey in props.style!) {
          if (props.style.hasOwnProperty(styleKey)) {
            el.style[styleKey] = props.style[styleKey];
          }
        }
      } else {
        //@ts-ignore
        el[key] = props[key]!;
      }
    }
  }
  if (typeof children === 'string') {
    el.textContent = children;
  } else if (Array.isArray(children)) {
    el.append(...children);
  } else {
    el.appendChild(children);
  }
  return el;
}
