---
ID: 20251209-091202
TAGS: commonlisp, io, file
---
# `with-open-file` – Dateien lesen und schreiben

## Konzept

`with-open-file` öffnet eine Datei und schließt sie nach Ende des Blocks automatisch.

## Beispiel: Speichern eines Lisp-Objekts

```lisp
(with-open-file (out "data.lisp" :direction :output :if-exists :supersede)
  (print '(:a 1 :b 2) out))
```

## Laden

```lisp
(with-open-file (in "data.lisp" :direction :input)
  (read in))
;; => (:A 1 :B 2)
```

## `with-standard-io-syntax`
```lisp
(with-open-file (in filename)
  (with-standard-io-syntax
    (setf *db* (read in))))
```

## Merkpunkte

- `print` und `read` erzeugen Lisp-lesbares Format  
- `with-standard-io-syntax` vermeidet Kompatibilitätsprobleme  
- automatische Ressourcenschließung

## Siehe auch

- [`Property Lists (Plists)`](./20251209-001800_property-lists-clisp.md)
- [`defvar` – globale dynamische Variablen](./20251209-085400_defvar-clisp.md)
