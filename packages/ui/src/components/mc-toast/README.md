# mc-toast

A short note at the foot of a screen: a link copied, why an action failed. It stands over its positioned parent, takes no
press and draws nothing while `text` is empty. The screen decides how long it stays (it sets and clears `text`).

```html
<mc-toast text="Link copied"></mc-toast>
```

| Property | Attribute | Type   | Meaning                                 |
| -------- | --------- | ------ | --------------------------------------- |
| `text`   | `text`    | string | What it says (translated); empty hides. |

CSS: `--mc-toast-bottom` (16px). It announces itself politely (`role="status"`). No events, no slots.
