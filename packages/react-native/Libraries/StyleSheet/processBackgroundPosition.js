/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

'use strict';
import type {BackgroundPositionValue} from './StyleSheetTypes';

export default function processBackgroundPosition(
  backgroundPosition: ?(ReadonlyArray<BackgroundPositionValue> | string),
): ReadonlyArray<BackgroundPositionValue> {
  let result: ReadonlyArray<BackgroundPositionValue> = [];

  if (backgroundPosition == null) {
    return [];
  }
  if (typeof backgroundPosition === 'string') {
    result = parseBackgroundPositionCSSString(
      backgroundPosition.replace(/\n/g, ' '),
    );
  } else if (Array.isArray(backgroundPosition)) {
    result = backgroundPosition;
  }

  return result;
}

// https://www.w3.org/TR/css-backgrounds-3/#typedef-bg-position
const parseBackgroundPositionCSSString = (
  backgroundPosition: string,
): ReadonlyArray<BackgroundPositionValue> => {
  const result: Array<BackgroundPositionValue> = [];
  const positions = backgroundPosition.split(',').map(s => s.trim());

  for (const position of positions) {
    let top: string | number;
    let left: string | number;
    let right: string | number;
    let bottom: string | number;
    const parts = position.split(/\s+/).filter(p => p.length > 0);
    // 1. Single value syntax [ left | center | right | top | bottom | <length-percentage> ]
    if (parts.length === 1) {
      const t1 = parts[0];
      if (t1 == null) {
        return [];
      }
      const token1 = t1.toLowerCase().trim();
      if (token1 === 'left') {
        left = '0%';
        top = '50%';
      } else if (token1 === 'center') {
        left = '50%';
        top = '50%';
      } else if (token1 === 'right') {
        left = '100%';
        top = '50%';
      } else if (token1 === 'top') {
        left = '50%';
        top = '0%';
      } else if (token1 === 'bottom') {
        left = '50%';
        top = '100%';
      } else if (isValidPosition(token1)) {
        const value = getPositionFromCSSValue(token1);
        if (value == null) {
          return [];
        }
        left = value;
        top = '50%';
      }
    }

    // 2. Two value syntax [ left | center | right | <length-percentage> ] [ top | center | bottom | <length-percentage> ]
    //    or two keywords in any order [ left | center | right ] && [ top | center | bottom ]
    if (parts.length === 2) {
      const t1 = parts[0];
      const t2 = parts[1];
      if (t1 == null || t2 == null) {
        return [];
      }
      let token1 = t1.toLowerCase().trim();
      let token2 = t2.toLowerCase().trim();
      // When both values are keywords the vertical one may come first
      // (e.g. 'top center', 'center left'). Normalize to horizontal-first so
      // the positional rules below apply.
      if (
        ((token1 === 'top' || token1 === 'bottom') &&
          (token2 === 'left' || token2 === 'center' || token2 === 'right')) ||
        (token1 === 'center' && (token2 === 'left' || token2 === 'right'))
      ) {
        [token1, token2] = [token2, token1];
      }

      if (token1 === 'left') {
        left = '0%';
      } else if (token1 === 'center') {
        left = '50%';
      } else if (token1 === 'right') {
        left = '100%';
      } else if (isValidPosition(token1)) {
        const value = getPositionFromCSSValue(token1);
        if (value == null) {
          return [];
        }
        left = value;
      }

      if (token2 === 'top') {
        top = '0%';
      } else if (token2 === 'center') {
        top = '50%';
      } else if (token2 === 'bottom') {
        top = '100%';
      } else if (isValidPosition(token2)) {
        const value = getPositionFromCSSValue(token2);
        if (value == null) {
          return [];
        }
        top = value;
      }
    }

    // 3. Three value syntax [ center | [ left | right ] <length-percentage>? ] && [ center | [ top | bottom ] <length-percentage>? ]
    if (parts.length === 3) {
      const t1 = parts[0];
      const t2 = parts[1];
      const t3 = parts[2];
      if (t1 == null || t2 == null || t3 == null) {
        return [];
      }
      const token1 = t1.toLowerCase().trim();
      const token2 = t2.toLowerCase().trim();
      const token3 = t3.toLowerCase().trim();
      // e.g. center top 40%, center left 40%
      if (token1 === 'center') {
        const value = getPositionFromCSSValue(token3);
        if (value == null) {
          return [];
        }
        if (token2 === 'top') {
          left = '50%';
          top = value;
        } else if (token2 === 'bottom') {
          left = '50%';
          bottom = value;
        } else if (token2 === 'left') {
          top = '50%';
          left = value;
        } else if (token2 === 'right') {
          top = '50%';
          right = value;
        } else {
          return [];
        }
      }
      // e.g. left 40% center, top 40% center
      else if (token3 === 'center') {
        const value = getPositionFromCSSValue(token2);
        if (value == null) {
          return [];
        }
        if (token1 === 'left') {
          top = '50%';
          left = value;
        } else if (token1 === 'right') {
          top = '50%';
          right = value;
        } else if (token1 === 'top') {
          left = '50%';
          top = value;
        } else if (token1 === 'bottom') {
          left = '50%';
          bottom = value;
        } else {
          return [];
        }
      }
      // e.g. left 40% top, left top 10%
      else {
        const tokens = [token1, token2, token3];
        for (let i = 0; i < tokens.length; i++) {
          const token = tokens[i];
          if (isValidPosition(token)) {
            const value = getPositionFromCSSValue(token);
            if (value == null) {
              return [];
            }
            // An offset is only valid directly after an edge keyword
            const previousToken = tokens[i - 1];
            if (previousToken === 'left') {
              left = value;
            } else if (previousToken === 'right') {
              right = value;
            } else if (previousToken === 'top') {
              top = value;
            } else if (previousToken === 'bottom') {
              bottom = value;
            } else {
              return [];
            }
          } else {
            if (token === 'left') {
              left = '0%';
            } else if (token === 'right') {
              right = '0%';
            } else if (token === 'top') {
              top = '0%';
            } else if (token === 'bottom') {
              bottom = '0%';
            } else {
              return [];
            }
          }
        }
      }
    }

    // 4. Four value syntax [ center | [ left | right ] <length-percentage>? ] && [ center | [ top | bottom ] <length-percentage>? ]
    if (parts.length === 4) {
      const t1 = parts.shift();
      const t2 = parts.shift();
      const t3 = parts.shift();
      const t4 = parts.shift();
      if (t1 == null || t2 == null || t3 == null || t4 == null) {
        return [];
      }
      const token1 = t1.toLowerCase().trim();
      const token2 = t2.toLowerCase().trim();
      const token3 = t3.toLowerCase().trim();
      const token4 = t4.toLowerCase().trim();
      const value1 = getPositionFromCSSValue(token2);
      const value2 = getPositionFromCSSValue(token4);
      if (value1 == null || value2 == null) {
        return [];
      }
      // The horizontal and vertical pairs may come in either order
      // (e.g. 'left 10px top 20px' or 'top 20px left 10px').
      for (const [keyword, value] of [
        [token1, value1],
        [token3, value2],
      ]) {
        if (keyword === 'left') {
          left = value;
        } else if (keyword === 'right') {
          right = value;
        } else if (keyword === 'top') {
          top = value;
        } else if (keyword === 'bottom') {
          bottom = value;
        } else {
          return [];
        }
      }
    }

    if (top != null && left != null) {
      result.push({
        top,
        left,
      });
    } else if (bottom != null && right != null) {
      result.push({
        bottom,
        right,
      });
    } else if (top != null && right != null) {
      result.push({
        top,
        right,
      });
    } else if (bottom != null && left != null) {
      result.push({
        bottom,
        left,
      });
    } else {
      return [];
    }
  }

  return result;
};

function getPositionFromCSSValue(position: string) {
  if (position.endsWith('px')) {
    return parseFloat(position);
  }

  if (position.endsWith('%')) {
    return position;
  }

  // CSS length allows 0 as a valid value
  if (position === '0') {
    return 0;
  }
}

function isValidPosition(position: string) {
  if (position.endsWith('px') || position.endsWith('%') || position === '0') {
    return true;
  }

  return false;
}
