import type { ImageMetadata } from '../../../application/ports/image-renderer.ts';

/** The EXIF fields sharp writes, by IFD (IFD0 the image's, IFD2 the Exif block's). */
export interface ExifTags {
  readonly IFD0: Record<string, string>;
  readonly IFD2: Record<string, string>;
}

/**
 * A shot date as EXIF has it, `2026:09:14 15:30:00`: only from a full date,
 * since EXIF can't say less (a day with no time is midnight). The XMP says as
 * much as is known.
 */
function exifDate(shot: string): string | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?$/.exec(shot);
  return match === null
    ? undefined
    : `${match[1] ?? ''}:${match[2] ?? ''}:${match[3] ?? ''} ${match[4] ?? '00:00'}:00`;
}

/** The EXIF for the metadata: author, copyright, notes, camera, date and lens. */
export function exifTags(metadata: ImageMetadata): ExifTags {
  const ifd0: Record<string, string> = {};
  const ifd2: Record<string, string> = {};
  const set = (
    tags: Record<string, string>,
    name: string,
    value: string | undefined,
  ) => {
    if (value !== undefined) {
      tags[name] = value;
    }
  };
  set(ifd0, 'Artist', metadata.author);
  set(ifd0, 'Copyright', metadata.copyright);
  set(ifd0, 'ImageDescription', metadata.description);
  set(ifd0, 'Make', metadata.cameraMake);
  set(ifd0, 'Model', metadata.cameraModel);
  set(
    ifd2,
    'DateTimeOriginal',
    metadata.shot === undefined ? undefined : exifDate(metadata.shot),
  );
  set(ifd2, 'LensModel', metadata.lens);
  return { IFD0: ifd0, IFD2: ifd2 };
}

/** The XMP packet's header names its encoding with a byte order mark. */
const byteOrderMark = String.fromCodePoint(0xfeff);

function escaped(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

const alternative = (text: string) =>
  `<rdf:Alt><rdf:li xml:lang="x-default">${escaped(text)}</rdf:li></rdf:Alt>`;

/** The XMP packet for the metadata, which says dates as precisely as they're known. */
export function xmpPacket(metadata: ImageMetadata): string {
  const properties: string[] = [];
  const add = (xml: string | undefined) => {
    if (xml !== undefined) {
      properties.push(xml);
    }
  };
  const text = (name: string, value: string | undefined) =>
    value === undefined ? undefined : `<${name}>${escaped(value)}</${name}>`;
  add(
    metadata.author === undefined
      ? undefined
      : `<dc:creator><rdf:Seq><rdf:li>${escaped(metadata.author)}</rdf:li></rdf:Seq></dc:creator>`,
  );
  add(
    metadata.copyright === undefined
      ? undefined
      : `<dc:rights>${alternative(metadata.copyright)}</dc:rights>`,
  );
  add(
    metadata.title === undefined
      ? undefined
      : `<dc:title>${alternative(metadata.title)}</dc:title>`,
  );
  add(
    metadata.description === undefined
      ? undefined
      : `<dc:description>${alternative(metadata.description)}</dc:description>`,
  );
  add(
    metadata.keywords === undefined || metadata.keywords.length === 0
      ? undefined
      : `<dc:subject><rdf:Bag>${metadata.keywords
          .map((keyword) => `<rdf:li>${escaped(keyword)}</rdf:li>`)
          .join('')}</rdf:Bag></dc:subject>`,
  );
  add(text('dc:identifier', metadata.reference));
  add(
    metadata.rating === undefined
      ? undefined
      : `<xmp:Rating>${String(metadata.rating)}</xmp:Rating>`,
  );
  add(text('photoshop:DateCreated', metadata.shot));
  add(text('tiff:Make', metadata.cameraMake));
  add(text('tiff:Model', metadata.cameraModel));
  add(text('aux:Lens', metadata.lens));
  add(text('filmfile:FilmStock', metadata.film));
  return `<?xpacket begin="${byteOrderMark}" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/" xmlns:tiff="http://ns.adobe.com/tiff/1.0/" xmlns:aux="http://ns.adobe.com/exif/1.0/aux/" xmlns:filmfile="http://filmfile.local/ns/1.0/">${properties.join('')}</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
}
