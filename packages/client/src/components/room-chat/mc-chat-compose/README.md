# mc-chat-compose

The chat's text field and Send. The field is a real `mc-text-field`; the scene keeps the draft (it hears `mc-input`, accepts
or `restoreValue`s) and hands it back as `value`.

```html
<mc-chat-compose .value="${draft}" placeholder="Say something" send-label="Send"></mc-chat-compose>
```

| Property      | Type      | Notes                                |
| ------------- | --------- | ------------------------------------ |
| `value`       | `string`  | the draft                            |
| `placeholder` | `string`  | the field's words                    |
| `send-label`  | `string`  | Send's word                          |
| `disabled`    | `boolean` | Send and Enter do nothing            |
| `field-stop`  | `string`  | the field's `data-stop` (chat-field) |
| `send-stop`   | `string`  | Send's `data-stop` (chat-send)       |

| Event          | Detail                                       |
| -------------- | -------------------------------------------- |
| `mc-room-chat` | `{ type: "send", via: "button" \| "enter" }` |

`field` is the text field (focus, blur, `restoreValue`).
