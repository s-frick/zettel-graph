# Zettelgraph

Convert zettel to graph
```bash
./convert.js markdown/*.md \
  | jq -s '
    . as $nodes
    | {
        nodes: $nodes,
        links: [
          $nodes[] as $n
          | ($n.refs // [])[]
          | .targetId as $tid
          | select(
              $tid != null and
              ($nodes | map(.id) | index($tid))
            )
          | { source: $n.id, target: $tid }
        ]
      }
  ' > graph.json
```

start a server
```bash
npx http-server
```
