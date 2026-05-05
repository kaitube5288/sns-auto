import { GoogleGenerativeAI, Part } from '@google/generative-ai'

const keys = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
].filter(Boolean) as string[]

const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash']

async function callGemini(
  prompt: string,
  imageParts?: Part[],
  keyIndex = 0,
  modelIndex = 0
): Promise<string> {
  if (modelIndex >= MODELS.length) throw new Error('모든 Gemini 모델 소진')
  if (keyIndex >= keys.length) return callGemini(prompt, imageParts, 0, modelIndex + 1)

  try {
    const genAI = new GoogleGenerativeAI(keys[keyIndex])
    const model = genAI.getGenerativeModel({ model: MODELS[modelIndex] })

    const parts: (string | Part)[] = imageParts ? [...imageParts, prompt] : [prompt]
    const result = await model.generateContent(parts)
    return result.response.text()
  } catch (err: unknown) {
    const error = err as { status?: number; message?: string }
    const retryable = error?.status === 429 || error?.status === 503
    if (retryable) {
      return callGemini(prompt, imageParts, keyIndex + 1, modelIndex)
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
