# Zettelgraph


https://github.com/user-attachments/assets/31a494ef-3917-4809-ae45-7f46ca2d1313




## Run it
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
