import { GoogleGenerativeAI, Part } from '@google/generative-ai'

const keys = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
].filter(Boolean) as string[]

async function callGemini(
  prompt: string,
  imageParts?: Part[],
  keyIndex = 0
): Promise<string> {
  if (keyIndex >= keys.length) throw new Error('모든 Gemini API 키 소진')

  try {
    const genAI = new GoogleGenerativeAI(keys[keyIndex])
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const parts: (string | Part)[] = imageParts ? [...imageParts, prompt] : [prompt]
    const result = await model.generateContent(parts)
    return result.response.text()
  } catch (err: unknown) {
    const error = err as { status?: number; message?: string }
    if (error?.status === 429 && keyIndex + 1 < keys.length) {
      return callGemini(prompt, imageParts, keyIndex + 1)
    }
    throw err
  }
}

export async function generateText(prompt: string): Promise<string> {
  return callGemini(prompt)
}

export async function generateWithImages(prompt: string, imageBase64List: string[]): Promise<string> {
  const imageParts: Part[] = imageBase64List.map(b64 => ({
    inlineData: {
      data: b64.replace(/^data:image\/\w+;base64,/, ''),
      mimeType: 'image/jpeg',
    },
  }))
  return callGemini(prompt, imageParts)
}

export function parseJSON<T>(text: string): T {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/)
  const raw = match ? match[1] || match[0] : text
  return JSON.parse(raw.trim())
}
