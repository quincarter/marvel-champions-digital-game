# Scenario filters

`<mc-scenario-filters>`

The top of Choose a scenario's list: the search field, the magnifier toggle that shows it on a narrow screen, the
Filters button (with the pad's Inspect hint beside it on a wide one) and the product chips. A wide screen draws the
field always, with the chips wrapped under it; a narrow one draws the toggle and the chips as one sideways rail, the
field only while the toggle is on.

Focus stops, in order: `scenario-search-toggle`, `scenario-search`, `filters-toggle`, `scenario-chip:<id>`.

## Usage

```html
<mc-scenario-filters></mc-scenario-filters>
```

## Properties

| Name    | Kind      | What it is                                     |
| ------- | --------- | ---------------------------------------------- |
| `model` | property  | `ScenarioFiltersModel`.                        |
| `wide`  | attribute | A wide screen's arrangement (set by the page). |

## Events

- `mc-scenario-select`: A `press` of a control or a chip, and a `search` with the typed text.

## Files

- `McScenarioFilters.ts`: the class
- `mc-scenario-filters.ts`: the define file (registers the element once)
- `mc-scenario-filters.styles.ts`: the constructible stylesheet
- `mc-scenario-filters.types.ts`: the property and event types
- `__tests__/`: the tests
