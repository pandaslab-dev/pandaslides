# PandaSlides Format and Schema

## Overview

PandaSlides exports projects as `.pandaslides` files. These files are plain JSON using the current schema version defined in the app, and are intended for future cross-platform use for the eventual SwiftUI version. 

Current schema version:

- `3`

The top-level project shape is:

```json
{
  "id": "service-abc12345",
  "name": "Sunday Service",
  "schemaVersion": 3,
  "kind": "service",
  "updatedAt": "2026-06-20T15:30:00.000Z",
  "serviceItems": []
}
```

## Top-level project fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `string` | yes | Unique project identifier |
| `name` | `string` | yes | Human-readable project name |
| `schemaVersion` | `number` | yes | Current value is `3` |
| `kind` | `string` | yes | One of the allowed project kinds |
| `updatedAt` | `string` | yes | ISO 8601 timestamp |
| `serviceItems` | `ServiceItem[]` | yes | Ordered sections in the deck |

Allowed `kind` values:

- `blank`
- `service`
- `event`
- `song-set`
- `demo`
- `custom`

## Service item schema

Each service item is an ordered block in the presentation.

```json
{
  "id": "message-1",
  "title": "Message",
  "type": "message",
  "orderIndex": 3,
  "subtitle": "Faithful in the Small Things",
  "slides": []
}
```

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `string` | yes | Unique item identifier |
| `title` | `string` | yes | Display title in the operator view |
| `type` | `string` | yes | One of the allowed service item types |
| `orderIndex` | `number` | yes | Determines order in the deck |
| `subtitle` | `string` | no | Secondary label for the item |
| `slides` | `Slide[]` | yes | Ordered slides within the item |

Allowed `type` values:

- `welcome`
- `song`
- `scripture`
- `message`
- `announcement`
- `closing`
- `custom`

## Slide schema

Each slide contains text plus optional media and presentation settings.

```json
{
  "id": "slide-1",
  "title": "Verse 1",
  "body": "Line one\nLine two\nLine three",
  "orderIndex": 0,
  "align": "center",
  "fontSize": "lg",
  "footer": "SONG",
  "image": {
    "dataUrl": "data:image/webp;base64,...",
    "name": "background.webp",
    "mimeType": "image/webp"
  },
  "audio": {
    "dataUrl": "data:audio/mpeg;base64,...",
    "name": "cue.mp3",
    "mimeType": "audio/mpeg"
  },
  "emoji": ":music:"
}
```

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `string` | yes | Unique slide identifier |
| `title` | `string` | yes | Short label shown in the operator view |
| `body` | `string` | yes | Main slide text, typically multiline |
| `orderIndex` | `number` | yes | Determines order within the service item |
| `align` | `string` | no | Defaults to `center` |
| `fontSize` | `string` | no | Defaults to `lg` |
| `footer` | `string` | no | Small label shown on the slide |
| `image` | `SlideMedia` | no | Embedded background image |
| `audio` | `SlideMedia` | no | Embedded audio cue |
| `emoji` | `string` | no | Short decorative marker |

Allowed `align` values:

- `left`
- `center`
- `right`

Allowed `fontSize` values:

- `sm`
- `md`
- `lg`
- `xl`

## SlideMedia schema

Images and audio are stored inline using data URLs.

```json
{
  "dataUrl": "data:image/webp;base64,...",
  "name": "background.webp",
  "mimeType": "image/webp"
}
```

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `dataUrl` | `string` | yes | Must start with `data:image/` or `data:audio/` |
| `name` | `string` | yes | Original file name |
| `mimeType` | `string` | yes | MIME type such as `image/webp` or `audio/mpeg` |

## Ordering rules

- `serviceItems` are sorted by `orderIndex`
- `slides` inside each service item are sorted by `orderIndex`
- the operator, display, and stage views all resolve slide order from those indexes

## Song import behavior

When a song is rebuilt from pasted text in the operator UI:

- blank lines split sections
- a heading like `[Verse 1]` or `Chorus:` becomes the slide title
- the remaining lines become the slide body
- chorus and tag sections are usually assigned larger default text

## Compatibility notes

The app still accepts an older legacy JSON structure and normalizes it into the current schema on import. Legacy files used fields such as:

- `title` instead of `name` at the project level
- `items` instead of `serviceItems`
- `label` and `lines` instead of `title` and `body` on slides

That means the exported `.pandaslides` format is the current canonical schema, while some older saved files can still be opened.
