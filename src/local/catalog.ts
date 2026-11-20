// Google Gemma models the user can download and run on-device (GGUF, run by llama.cpp via llama.rn).
// Files are fetched straight from Hugging Face; all of these repos are public and Apache-2.0.
export type LocalFile = { name: string; url: string; sizeMB: number };

export type LocalModel = {
  id: string;
  name: string;
  family: string;
  blurb: string;
  ramHint: string;
  /** Text model file */
  model: LocalFile;
  /** Vision projector (enables screenshots) */
  mmproj?: LocalFile;
  recommended?: boolean;
};

const hf = (repo: string, file: string) => `https://huggingface.co/${repo}/resolve/main/${file}`;

export const LOCAL_MODELS: LocalModel[] = [
  {
    id: 'gemma-4-e2b-q4',
    name: 'Gemma 4 E2B',
    family: 'Gemma 4 · latest',
    blurb: 'Best balance for most phones. Understands screenshots.',
    ramHint: '6 GB+ RAM',
    recommended: true,
    model: { name: 'gemma-4-E2B-it-Q4_0.gguf', url: hf('ggml-org/gemma-4-E2B-it-GGUF', 'gemma-4-E2B-it-Q4_0.gguf'), sizeMB: 2841 },
    mmproj: { name: 'mmproj-gemma-4-E2B-it-Q8_0.gguf', url: hf('ggml-org/gemma-4-E2B-it-GGUF', 'mmproj-gemma-4-E2B-it-Q8_0.gguf'), sizeMB: 557 },
  },
  {
    id: 'gemma-4-e2b-mobile',
    name: 'Gemma 4 E2B · compact',
    family: 'Gemma 4 · mobile QAT',
    blurb: 'Smaller download and memory use, a little less accurate.',
    ramHint: '4 GB+ RAM',
    model: { name: 'gemma-4-E2B-it-qat-UD-Q2_K_XL.gguf', url: hf('unsloth/gemma-4-E2B-it-qat-mobile-GGUF', 'gemma-4-E2B-it-qat-UD-Q2_K_XL.gguf'), sizeMB: 2186 },
    mmproj: { name: 'mmproj-E2B-F16.gguf', url: hf('unsloth/gemma-4-E2B-it-qat-mobile-GGUF', 'mmproj-F16.gguf'), sizeMB: 986 },
  },
  {
    id: 'gemma-4-e4b-q4',
    name: 'Gemma 4 E4B',
    family: 'Gemma 4 · latest',
    blurb: 'Smarter than E2B, noticeably slower. For high-end phones.',
    ramHint: '8 GB+ RAM',
    model: { name: 'gemma-4-E4B-it-Q4_0.gguf', url: hf('ggml-org/gemma-4-E4B-it-GGUF', 'gemma-4-E4B-it-Q4_0.gguf'), sizeMB: 4591 },
    mmproj: { name: 'mmproj-gemma-4-E4B-it-Q8_0.gguf', url: hf('ggml-org/gemma-4-E4B-it-GGUF', 'mmproj-gemma-4-E4B-it-Q8_0.gguf'), sizeMB: 560 },
  },
  {
    id: 'gemma-4-e4b-mobile',
    name: 'Gemma 4 E4B · compact',
    family: 'Gemma 4 · mobile QAT',
    blurb: 'E4B quality in a smaller package.',
    ramHint: '6 GB+ RAM',
    model: { name: 'gemma-4-E4B-it-qat-UD-Q2_K_XL.gguf', url: hf('unsloth/gemma-4-E4B-it-qat-mobile-GGUF', 'gemma-4-E4B-it-qat-UD-Q2_K_XL.gguf'), sizeMB: 3220 },
    mmproj: { name: 'mmproj-E4B-F16.gguf', url: hf('unsloth/gemma-4-E4B-it-qat-mobile-GGUF', 'mmproj-F16.gguf'), sizeMB: 990 },
  },
  {
    id: 'gemma-4-12b-q4',
    name: 'Gemma 4 12B',
    family: 'Gemma 4 · large',
    blurb: 'Strongest option here. Very slow on phones; flagship devices only.',
    ramHint: '16 GB+ RAM',
    model: { name: 'gemma-4-12B-it-Q4_0.gguf', url: hf('ggml-org/gemma-4-12B-it-GGUF', 'gemma-4-12B-it-Q4_0.gguf'), sizeMB: 7220 },
    mmproj: { name: 'mmproj-gemma-4-12B-it-Q8_0.gguf', url: hf('ggml-org/gemma-4-12B-it-GGUF', 'mmproj-gemma-4-12B-it-Q8_0.gguf'), sizeMB: 159 },
  },
  {
    id: 'gemma-3-1b-q4',
    name: 'Gemma 3 1B',
    family: 'Gemma 3',
    blurb: 'Tiny and fast, text only. Good for trying the feature; weak at multi-step tasks.',
    ramHint: '3 GB+ RAM',
    model: { name: 'gemma-3-1b-it-Q4_K_M.gguf', url: hf('ggml-org/gemma-3-1b-it-GGUF', 'gemma-3-1b-it-Q4_K_M.gguf'), sizeMB: 806 },
  },
];

export const localModelById = (id: string) => LOCAL_MODELS.find((m) => m.id === id);
export const totalSizeMB = (m: LocalModel) => m.model.sizeMB + (m.mmproj?.sizeMB ?? 0);
