# Furniture Finder MCP

Stdio server. The caller's model does the render. This process does not call an image API.

From this folder:

```bash
node server.mjs
```

## Tools

### straighten_photo

Straighten a listing photo toward parallel verticals.

| Input | Required | Meaning |
| --- | --- | --- |
| `quad` | yes | Four `{x, y}` corners of the wall, in image pixels, top-left then clockwise |
| `image_path` | no | Photo path, absolute or relative to the repo |
| `image_base64` | no | Photo bytes as base64, when there is no path |

Until `src/lib/perspective.js` can warp inside this process, the tool returns the same photo and the same corners, plus a note.

### list_products

No inputs. Reads `data/furniture.db` through `src/lib/products.js`. A missing database returns an empty list.

Each product includes `id`, seller, category, width, height, depth in inches, and photo paths.

### place_brief

JSON brief for an external image model. No pixels are composited here.

| Input | Required | Meaning |
| --- | --- | --- |
| `product_id` | yes | Id from `list_products` |
| `room_photo` | yes | Path or URL of the straightened room photo |
| `bbox` | yes | `{x, y, width, height}` in room-photo pixels |

The result is `{ room_photo, product_id, product_photos, bbox, inches }`.

### list_scenes

No inputs. Lists the scenes saved from `/studio`, newest first. They live in `data/scenes/<id>/`.

### render_scene

The final render for one scene, for the caller's image model.

| Input | Required | Meaning |
| --- | --- | --- |
| `scene_id` | yes | Id from `list_scenes`, or the one `/studio` showed after saving |
| `include_images` | no | Attach images inline. Default `true`. With `false`, only file paths |

Returns the render prompt, file paths, and the images: the straightened room, the mockup with cutouts placed at true scale, the gap mask (white is what straightening invented), and each piece's reference photo. The gaps are filled in this same render, not in an earlier pass.
