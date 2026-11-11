/** The selected snapshot keeps its reference until the fields read by the consumer change. */
export function snapshotSelection<S, T>(
  read: () => S,
  selector: (snapshot: S) => T,
  isEqual: (left: T, right: T) => boolean,
) {
  let cached: { snapshot: S; selected: T } | undefined;
  return () => {
    const snapshot = read();
    if (cached && Object.is(cached.snapshot, snapshot)) return cached.selected;
    const selected = selector(snapshot);
    cached = {
      snapshot,
      selected: cached && isEqual(cached.selected, selected) ? cached.selected : selected,
    };
    return cached.selected;
  };
}

export function sameFields<T extends object>(left: T, right: T): boolean {
  const keys = Object.keys(left) as (keyof T)[];
  return keys.length === Object.keys(right).length && keys.every(key =>
    Object.hasOwn(right, key) && Object.is(left[key], right[key]));
}
