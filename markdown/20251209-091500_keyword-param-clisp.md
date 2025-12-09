---
ID: 20251209-091500
TAGS: commonlisp, functions, keyword-parameters, defaults, supplied
---
# Keyword-Parameter (`&key`)

## Konzept

Keyword-Parameter erlauben benannte, optionale Argumente mit Default-Werten.

## Beispiel

```lisp
(defun foo (&key a (b 20) (c 30 c-supplied-p))
  (list a b c c-supplied-p))
```

## Aufrufe

```lisp
(foo :a 1 :c 5)
;; => (1 20 5 T)

(foo)
;; => (NIL 20 30 NIL)
```

## Merkpunkte

- Reihenfolge egal  
- Default-Werte möglich  
- `supplied-p` zeigt an, ob ein Parameter übergeben wurde  

## Siehe auch

- [`lambda`, `#'` und Funktionsobjekte](./20251209-091200_higher-order-fn.clisp.md)
