import { NextRequest, NextResponse } from 'next/server';
import { getGeminiClient } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

export interface GroundingLink {
  title: string;
  uri: string;
  kind: 'web' | 'maps';
  snippet?: string;
}

interface RawGroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
  maps?: {
    uri?: string;
    title?: string;
    placeAnswerSources?: {
      reviewSnippets?: Array<{
        uri?: string;
        title?: string;
        text?: string;
      }>;
    };
  };
}

function extractGroundingLinks(chunks: unknown): GroundingLink[] {
  if (!Array.isArray(chunks)) return [];
  const seen = new Set<string>();
  const links: GroundingLink[] = [];

  for (const raw of chunks as RawGroundingChunk[]) {
    if (raw?.web?.uri) {
      const uri = raw.web.uri;
      if (!seen.has(uri)) {
        seen.add(uri);
        links.push({
          title: raw.web.title || uri,
          uri,
          kind: 'web',
        });
      }
    }
    if (raw?.maps?.uri) {
      const uri = raw.maps.uri;
      if (!seen.has(uri)) {
        seen.add(uri);
        links.push({
          title: raw.maps.title || 'View on Google Maps',
          uri,
          kind: 'maps',
        });
      }
      const snippets = raw.maps.placeAnswerSources?.reviewSnippets;
      if (Array.isArray(snippets)) {
        for (const snippet of snippets) {
          if (snippet?.uri && !seen.has(snippet.uri)) {
            seen.add(snippet.uri);
            links.push({
              title: snippet.title || raw.maps.title || 'Google Maps Review',
              uri: snippet.uri,
              kind: 'maps',
              snippet: snippet.text,
            });
          }
        }
      }
    }
  }

  return links;
}

export async function POST(request: NextRequest) {
  let body: {
    mode?: 'search' | 'maps';
    city?: string;
    country?: string;
    lat?: number;
    lon?: number;
    condition?: string;
    tempC?: number;
    alertTitles?: string[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON request body.' },
      { status: 400 }
    );
  }

  const mode = body.mode === 'maps' ? 'maps' : 'search';
  const city = typeof body.city === 'string' ? body.city.trim() : '';
  const country = typeof body.country === 'string' ? body.country.trim() : '';
  const lat = typeof body.lat === 'number' && Number.isFinite(body.lat) ? body.lat : null;
  const lon = typeof body.lon === 'number' && Number.isFinite(body.lon) ? body.lon : null;

  if (!city) {
    return NextResponse.json(
      { error: 'A city name is required for live weather intelligence.' },
      { status: 400 }
    );
  }

  const locationLabel = country ? `${city}, ${country}` : city;
  const alertContext =
    Array.isArray(body.alertTitles) && body.alertTitles.length > 0
      ? ` Active official alerts: ${body.alertTitles.join(', ')}.`
      : '';
  const conditionContext =
    typeof body.condition === 'string' && typeof body.tempC === 'number'
      ? ` Current observed conditions: ${body.condition}, ${Math.round(body.tempC)}°C.`
      : '';

  try {
    const ai = getGeminiClient();

    if (mode === 'maps') {
      const prompt =
        `Based on the weather in ${locationLabel} (${conditionContext.trim() || 'current local weather'}${alertContext}), ` +
        `recommend 3 to 4 real, currently operating nearby places suited to these conditions ` +
        `(for example: indoor public libraries, community centers, museums, or shelters if weather is harsh/wet/extreme, ` +
        `or scenic parks, cafes, and promenades if weather is mild/clear). ` +
        `For each place, briefly explain why it fits today's weather. Keep the response concise and formatted in clean Markdown.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          tools: [{ googleMaps: {} }],
          ...(lat !== null && lon !== null
            ? {
                toolConfig: {
                  retrievalConfig: {
                    latLng: {
                      latitude: lat,
                      longitude: lon,
                    },
                  },
                },
              }
            : {}),
        },
      });

      const chunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const links = extractGroundingLinks(chunks);

      return NextResponse.json({
        mode: 'maps',
        markdown: response.text || 'No nearby place recommendations returned.',
        links,
      });
    }

    // Search Grounding mode: up-to-date weather advisories, travel impacts & bulletins
    const searchPrompt =
      `Provide a concise, up-to-date live weather briefing for ${locationLabel}.${conditionContext}${alertContext} ` +
      `Check current official weather advisories, severe weather warnings (such as flash flood, heat advisory, storm, air quality, or wind alerts), ` +
      `and any notable local weather-related travel or safety updates happening today. ` +
      `Keep it factual, brief (under 180 words), and formatted with clean Markdown bullet points. Do not invent alerts if none are active.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: searchPrompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const chunks =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const links = extractGroundingLinks(chunks);

    return NextResponse.json({
      mode: 'search',
      markdown: response.text || 'No live weather briefing returned.',
      links,
    });
  } catch (err: unknown) {
    const rawMessage =
      err instanceof Error ? err.message : String(err || '');

    let extracted = rawMessage;
    try {
      const parsed = JSON.parse(rawMessage);
      if (parsed?.error?.message && typeof parsed.error.message === 'string') {
        extracted = parsed.error.message;
      }
    } catch {
      // Not a raw JSON error payload
    }

    const upper = rawMessage.toUpperCase();
    if (
      upper.includes('API_KEY_INVALID') ||
      upper.includes('PERMISSION_DENIED') ||
      upper.includes('MISSING')
    ) {
      return NextResponse.json(
        {
          error:
            'Unable to authenticate with the Gemini API. Please check your API key in Settings > Secrets.',
        },
        { status: 403 }
      );
    }

    if (upper.includes('RESOURCE_EXHAUSTED') || upper.includes('"CODE":429') || upper.includes('429')) {
      return NextResponse.json(
        {
          error:
            'Live grounding quota is temporarily reached for the current API key. Please retry shortly or select a billing-enabled key in Settings > Secrets.',
        },
        { status: 429 }
      );
    }

    const cleanMessage =
      extracted && extracted.length < 220 && !extracted.trim().startsWith('{')
        ? extracted
        : 'Unable to retrieve live weather intelligence right now. Please try again shortly.';

    return NextResponse.json({ error: cleanMessage }, { status: 500 });
  }
}
