---
layout: post
title: 'Seventeen file processors, six categories, one priority system'
date: '2026-06-01 09:00:00 +0530'
categories:
  - Deep Dive
  - Engineering
tags:
  - neurolink
author: neurolink
description: >-
  Seventeen file processors, six categories, one priority system — companion deep-dive for the NeuroLink blog with architectural detail and code examples.
toc: true
mermaid: true
pin: false
image:
  path: /assets/img/posts/seventeen-file-processors-six-categories-one-priority-system/hero.png
  alt: 'Seventeen file processors, six categories, one priority system'
---

We designed NeuroLink's file processing framework because inconsistent file handling was silently breaking our AI agent workflows. An agent could extract text from a `.docx` file uploaded by a user, but the same workflow would fail on an `.rtf` file containing the exact same information. A `.zip` archive created on macOS would fail to unpack where a Windows-generated one succeeded. These subtle inconsistencies meant that any AI agent relying on user-provided files, whether for RAG with a Claude model or for data analysis, was operating on a foundation of sand. We needed a unified, predictable system that could see a file path, identify its contents, and route it to a specialized processor that understood its format, from Microsoft Word documents to FFmpeg-compatible video streams.

## The Core Lifecycle: BaseFileProcessor

Every file processor in NeuroLink inherits from a single abstract class: `BaseFileProcessor`. This class establishes a consistent, three-stage lifecycle for every file we handle, whether we're processing a 10-line YAML file or a video that hits our size limits. The core logic lives in the `processFile` method, which orchestrates the entire flow.

This shared foundation ensures that every processor, regardless of the file format it handles, adheres to the same contract for downloading, validation, and processing. It's an architecture that parallels how we think about provider integrations; just as every LLM provider has a common interface, every file format gets a common processing pattern. You can learn more about that philosophy in [What You Actually Inherit When You Extend BaseProvider](/posts/what-you-actually-inherit-when-you-extend-baseprovider/).

The lifecycle consists of three main steps managed by `BaseFileProcessor`:

1. **Download**: The `downloadFile` method retrieves the file from its source. It's wrapped in a `downloadFileWithRetry` helper that handles transient network errors, a critical feature for robustly handling large files from remote storage.

2. **Validate**: `validateDownloadedFile` runs a series of checks. It uses helpers like `validateFileSize` and `isSupportedMimeType` to ensure the file is something we can and should handle before committing more resources. This is our first line of defense against malformed or malicious inputs.

3. **Build**: The abstract `buildProcessedResult` method is where the specialized logic for each processor lives. This is the method that a subclass like `WordProcessor` or `VideoProcessor` must implement to perform its unique parsing and data extraction.

This common structure is what allows the system to be so extensible. Adding support for a new file type means creating a new class that extends `BaseFileProcessor` and implements a single method.

```typescript
export abstract class BaseFileProcessor<T extends ProcessedFileBase> {
  // ... constructor and config ...

  async processFile(
    fileInfo: FileInfo,
    options?: FileProcessorOptions,
  ): Promise<Result<T, FileProcessingError>> {
    // 1. Download the file with retries
    const bufferResult = await this.downloadFileWithRetry(fileInfo, options);
    if (!bufferResult.isSuccess) {
      return err(bufferResult.error);
    }

    // 2. Validate the downloaded file
    const validationResult = await this.validateDownloadedFileWithResult(fileInfo, bufferResult.value);
    if (!validationResult.isSuccess) {
      return err(validationResult.error);
    }

    // 3. Build the processed result using subclass-specific logic
    return this.buildProcessedResultWithResult(bufferResult.value, fileInfo, options);
  }

  protected abstract buildProcessedResult(
    buffer: Buffer,
    fileInfo: FileInfo,
    options?: FileProcessorOptions,
  ): Promise<Result<T, FileProcessingError>>;

  // ... other helper methods ...
}
```

## Document Processors: The Office Suite and Beyond

This is one of the most common categories of files users upload. Our goal is to extract clean text and metadata from a variety of proprietary and open document formats.

- `WordProcessor`: Handles `.docx` files. It uses the `mammoth` library (loaded via `loadMammoth`) to convert Word documents into HTML and plain text, preserving headings and lists where possible. This is critical for maintaining document structure for RAG.
- `ExcelProcessor`: Parses `.xlsx` files. It can extract data from specified sheets and rows, turning spreadsheets into structured data that an AI agent can analyze.
- `PptxProcessor`: Extracts text content from every slide in a `.pptx` presentation file. This allows an agent to "read" a presentation deck.
- `RtfProcessor`: Provides support for Rich Text Format (`.rtf`) files. The `extractText` method provides a best-effort conversion to plain text.
- `OpenDocumentProcessor`: Handles the Open Document Format (ODF) files used by LibreOffice and other open-source suites, such as `.odt` for text and `.ods` for spreadsheets.

```typescript
// Example check for the WordProcessor
import { DOCX_MIME_TYPE } from './constants';

export function isWordFile(mimetype: string, filename: string): boolean {
  return (
    mimetype === DOCX_MIME_TYPE ||
    filename.toLowerCase().endsWith('.docx')
  );
}
```

## Data Processors: Structured Input

When the input isn't a human-readable document but structured data for a system to read, these processors take over.

- `JsonProcessor`: Parses `.json` files. It validates the JSON syntax and makes the data available as a JavaScript object.
- `YamlProcessor`: Handles `.yml` and `.yaml` files, which are common for configuration and data serialization.
- `XmlProcessor`: A processor for `.xml` files. Given the verbosity of XML, this processor focuses on extracting the core data content.

These processors are fundamental for any workflow involving configuration files, API responses, or data exports.

```yaml
# A sample file for the YamlProcessor
user:
  id: 123
  name: "John Doe"
  roles:
    - admin
    - editor
```

## Markup Processors: From HTML to Plain Text

This category handles files that are primarily text but include structural or presentational markup.

- `HtmlProcessor`: Takes `.html` files and strips the markup to extract the raw text content, which is often the goal when feeding web content to an LLM.
- `SvgProcessor`: While SVGs are images, they are also XML-based markup. The `SvgProcessor` can extract any text elements or metadata embedded within an `.svg` file.
- `MarkdownProcessor`: Parses `.md` files, a common format for documentation and notes. It can provide either the raw Markdown source or a converted HTML representation.
- `TextProcessor`: The most basic processor. It handles `.txt` files and serves as a fallback for any unrecognized text-based format. Its `isFileSupported` logic is broad.

```typescript
// The TextProcessor is a general-purpose tool
export function isTextFile(mimetype: string, filename: string): boolean {
  if (mimetype.startsWith('text/')) {
    // Exclude specific text subtypes handled by other processors
    if (mimetype === 'text/csv' || mimetype === 'text/html' || mimetype === 'text/markdown') {
      return false;
    }
    return true;
  }
  // ... fallback logic for common text extensions
  return false;
}
```

## Code Processors: Understanding Source and Configuration

We treat source code and configuration as first-class file types. This is essential for AI-powered developer tools like our internal code reviewer, Yama.

- `SourceCodeProcessor`: This processor doesn't execute code. Its job is to identify the programming language using `detectLanguageFromFilename` and prepare it for analysis or display. It recognizes a wide array of file extensions from the internal `LANGUAGE_MAP`.
- `ConfigProcessor`: This specialized processor handles common configuration files like `.env` or `credentials.json`. It has a critical security function: it uses `isSensitiveKey` and `redactContent` to automatically find and redact secrets like API keys or passwords before the content is passed to any other part of the system.

```typescript
// The ConfigProcessor redacts sensitive data before processing.
// A file like this:
// API_KEY=sk-1234567890abcdef
// DATABASE_URL=postgres://user:pass@host:5432/db

// Would be processed into something like this:
// API_KEY=[REDACTED]
// DATABASE_URL=postgres://user:[REDACTED]@host:5432/db
```

## Media Processors: Video and Audio

Processing media files is by far the most computationally intensive task. These processors are designed to extract textual and summary information from binary media formats.

- `AudioProcessor`: Handles audio files like `.mp3` and `.wav`. Its primary function is to feed the audio data to a speech-to-text model to get a transcription.
- `VideoProcessor`: This is one of our most complex processors. For video files, it uses FFmpeg (via `loadFluentFfmpeg`) to perform multiple operations. The `extractKeyframes` method generates representative images from the video, while `extractSubtitles` pulls out any embedded subtitle tracks. The `probeVideo` function reads metadata like duration and resolution. This allows an agent to understand the content of a video without having to "watch" the whole thing.

The complexity and resource usage of these processors mean they have stricter size limits and timeouts, which are validated early in the `BaseFileProcessor` lifecycle.

```typescript
// The VideoProcessor can identify video files by MIME type or extension.
export function isVideoFile(mimetype: string, filename: string): boolean {
  if (mimetype.startsWith('video/')) {
    return true;
  }
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext);
}
```

## Archive Processors: Unpacking the Containers

A single uploaded file can contain an entire project. The `ArchiveProcessor` is responsible for unpacking these containers.

- `ArchiveProcessor`: This single processor handles multiple formats. It uses `detectArchiveFormat` by checking magic bytes and file extensions to identify `.zip`, `.tar`, `.gz`, and `.tar.gz` files. Once identified, it uses methods like `extractZipEntries` or `extractTarEntries` to list the contents. A key security feature is the `hasPathTraversal` check, which prevents "zip slip" vulnerabilities where a malicious archive tries to write files outside of its extraction directory. The processor can produce a text manifest of the archive's contents or `extractEntry` a specific file from it.

```typescript
// The ArchiveProcessor detects format from file extension as a fallback
private detectFormatFromExtension(filename: string): ArchiveFormat | null {
  const lowerFile = filename.toLowerCase();
  if (lowerFile.endsWith('.zip')) return 'zip';
  if (lowerFile.endsWith('.tar.gz') || lowerFile.endsWith('.tgz')) return 'targz';
  if (lowerFile.endsWith('.tar')) return 'tar';
  if (lowerFile.endsWith('.gz')) return 'gz';
  return null;
}
```

## One Registry to Rule Them All

With seventeen different processors, the system needs a way to choose the right one for any given file. This is the job of the `ProcessorRegistry`. When a file is submitted, the central `processFileWithRegistry` function queries the registry to find a suitable handler.

The selection logic, exposed via `getProcessorForFile`, is not just a simple MIME type lookup. Some files can be ambiguous. For example, an `.xml` file could be generic data for the `XmlProcessor` or a vector graphic for the `SvgProcessor`.

To resolve this, we use a priority system. Each processor registers itself with a numeric priority. The `ProcessorRegistry` iterates through all processors and asks each one if it `isFileSupported`. It collects all "yes" votes and picks the one with the highest priority (lowest number). This ensures that the most specific processor always wins.

```mermaid
graph TD
    subgraph NeuroLink File Processing
        A[File Uploaded: report.docx] --> B{MIME Type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
        B --> C["ProcessorRegistry.findProcessor()"];
        C --> D{Priority Check};
        D -- Priority 10 --> E[TextProcessor? No];
        D -- Priority 5 --> F[ArchiveProcessor? No];
        D -- Priority 1 --> G["WordProcessor? Yes!"];
        G --> H["WordProcessor.processFile()"];
        H --> I[ProcessedResult: Text + Metadata];
    end
```

This entire system is a testament to the power of building small, specialized tools that do one thing well, then composing them into a larger, robust whole. It's a pattern that ensures our platform can handle the diverse data needs of modern AI applications, and it's rigorously tested as part of our commitment to quality. You can read more about that in our post, [How We Test NeuroLink: 20 Continuous Test Suites and Counting](/posts/neurolink-testing-20-test-suites/). The structured output from these processors is a critical input for higher-level orchestration, such as [Dynamic Model Selection: Routing AI Requests at Runtime](/posts/dynamic-model-selection-runtime/).

---

**Related posts:**

- [What You Actually Inherit When You Extend BaseProvider](/posts/what-you-actually-inherit-when-you-extend-baseprovider/)
- [How We Test NeuroLink: 20 Continuous Test Suites and Counting](/posts/neurolink-testing-20-test-suites/)
