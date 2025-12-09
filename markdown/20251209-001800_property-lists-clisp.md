---
ID: 20251209-001800
TAGS: commonlisp, plist
---
# Property Lists (Plists) in Common Lisp

## Konzept

Eine Property List (plist) ist eine einfache Liste aus Schlüssel–Wert-Paaren, meist mit Keywords.

## Beispiel

```lisp
(list :a 1 :b 2 :c 3)
;; => (:A 1 :B 2 :C 3)
```

## Zugriff

```lisp
(getf (list :a 1 :b 2 :c 3) :c)
;; => 3
```

## Merkpunkte

- Plists bestehen aus alternierenden Keys und Values.
- Zugriff erfolgt über `getf`.
- Flexibel und dynamisch, aber ohne Typsicherheit.
