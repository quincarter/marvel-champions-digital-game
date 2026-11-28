# mc-credits-page

The Art & Credits screen as one element: the ink `mc-top-bar` (Back and the title) over the read-only `mc-credits-list`. It composes and holds no state: the scene sets `model` and hears `mc-credits`.

| Property | Type               | Meaning                                          |
| -------- | ------------------ | ------------------------------------------------ |
| `model`  | `CreditsPageModel` | The bar and the rows.                            |
| `phone`  | attribute          | Set from the model: the phone's bar and gutters. |

Events: `mc-credits` `{ type: "back" }` from the bar's Back.

Needs `@mc/ui` defined.
