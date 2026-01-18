"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import WordCloudComponent from "@/components/WordCloud";
import JobManagement from "@/components/JobManagement";

const BIOTECH_TERMS = [
  { text: "neural implant stability", value: 100 },
  { text: "gliosis", value: 85 },
  { text: "micromotion", value: 80 },
  { text: "spike sorting", value: 75 },
  { text: "CRISPR", value: 95 },
  { text: "single-cell RNA-seq", value: 90 },
  { text: "AAV gene therapy", value: 88 },
  { text: "organoids", value: 82 },
  { text: "brain-computer interface", value: 92 },
  { text: "optogenetics", value: 78 },
  { text: "CAR-T therapy", value: 86 },
  { text: "mRNA vaccines", value: 94 },
  { text: "protein folding", value: 77 },
  { text: "synthetic biology", value: 84 },
  { text: "microbiome", value: 81 },
  { text: "CRISPR base editing", value: 89 },
  { text: "neural recording", value: 76 },
  { text: "biocompatible materials", value: 79 },
  { text: "tissue engineering", value: 83 },
  { text: "immunotherapy", value: 87 },
  { text: "gene therapy", value: 91 },
  { text: "stem cell therapy", value: 88 },
  { text: "nanomedicine", value: 85 },
  { text: "bioinformatics", value: 82 },
  { text: "proteomics", value: 79 },
  { text: "metabolomics", value: 77 },
  { text: "epigenetics", value: 84 },
  { text: "regenerative medicine", value: 86 },
  { text: "precision medicine", value: 89 },
  { text: "drug delivery systems", value: 81 },
  { text: "bioprinting", value: 78 },
  { text: "lab-grown meat", value: 73 },
  { text: "xenotransplantation", value: 74 },
  { text: "gene editing", value: 93 },
  { text: "monoclonal antibodies", value: 85 },
  { text: "checkpoint inhibitors", value: 82 },
  { text: "RNA interference", value: 80 },
  { text: "CRISPR-Cas9", value: 96 },
  { text: "base editing", value: 87 },
  { text: "prime editing", value: 84 },
  { text: "spatial transcriptomics", value: 88 },
  { text: "cryo-EM", value: 76 },
  { text: "AlphaFold", value: 90 },
  { text: "neural organoids", value: 83 },
  { text: "brain mapping", value: 81 },
  { text: "synaptic plasticity", value: 86 },
  { text: "neurodegeneration", value: 84 },
  { text: "blood-brain barrier", value: 82 },
  { text: "mitochondrial dysfunction", value: 78 },
  { text: "autophagy", value: 80 },
  { text: "senescence", value: 77 },
  { text: "telomere biology", value: 79 },
  { text: "circadian rhythms", value: 75 },
  { text: "gut-brain axis", value: 83 },
  { text: "extracellular vesicles", value: 81 },
  { text: "liquid biopsy", value: 85 },
  { text: "tumor microenvironment", value: 84 },
  { text: "cancer metabolism", value: 82 },
  { text: "immune checkpoint", value: 87 },
  { text: "cytokine storm", value: 79 },
  { text: "antibody-drug conjugates", value: 86 },
  { text: "bispecific antibodies", value: 84 },
  { text: "cell-free DNA", value: 80 },
  { text: "ATAC-seq", value: 78 },
  { text: "ChIP-seq", value: 77 },
  { text: "Hi-C sequencing", value: 76 },
  { text: "long-read sequencing", value: 85 },
  { text: "metagenomics", value: 83 },
  { text: "pharmacogenomics", value: 81 },
  { text: "systems biology", value: 82 },
  { text: "network medicine", value: 80 },
  { text: "digital pathology", value: 79 },
  { text: "AI drug discovery", value: 91 },
  { text: "protein engineering", value: 88 },
  { text: "directed evolution", value: 85 },
  { text: "synthetic genomes", value: 84 },
  { text: "minimal cells", value: 76 },
  { text: "biosensors", value: 82 },
  { text: "microfluidics", value: 80 },
  { text: "organ-on-chip", value: 87 },
  { text: "3D bioprinting", value: 86 },
  { text: "decellularization", value: 78 },
  { text: "scaffold biomaterials", value: 81 },
  { text: "hydrogels", value: 79 },
  { text: "nanoparticles", value: 83 },
  { text: "quantum dots", value: 77 },
  { text: "FRET imaging", value: 75 },
  { text: "super-resolution microscopy", value: 84 },
  { text: "light-sheet microscopy", value: 82 },
  { text: "two-photon imaging", value: 80 },
];

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showJobManagement, setShowJobManagement] = useState(false);

  const handleWordClick = async (word: string) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicQuery: word }),
      });

      const data = await response.json();
      if (data.jobId) {
        router.push(`/job/${data.jobId}`);
      }
    } catch (error) {
      console.error("Error creating job:", error);
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Top Navigation Bar */}
      <div className="absolute top-0 right-0 p-6 z-10">
        <button
          onClick={() => setShowJobManagement(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/90 backdrop-blur-sm text-gray-800 rounded-xl hover:bg-white transition-all shadow-lg hover:shadow-xl font-semibold border border-gray-200"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
            />
          </svg>
          View All Jobs
        </button>
      </div>

      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16 animate-fade-in">
          <div className="inline-block mb-4">
            <div className="flex items-center justify-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg
                  className="w-7 h-7 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                </svg>
              </div>
              <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Hypothesis Atlas
              </h1>
            </div>
          </div>
          <p className="text-2xl text-gray-700 mb-3 font-medium">
            AI-Powered Evidence Mapping for Biotech Research
          </p>
          <p className="text-base text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Explore cutting-edge research topics • Discover connections • Map
            the evidence landscape
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-500 flex-wrap">
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
              90+ Topics
            </span>
            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full font-medium">
              Real-time Analysis
            </span>
            <span className="px-3 py-1 bg-pink-100 text-pink-700 rounded-full font-medium">
              Multi-source
            </span>
            <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full font-medium">
              LLM-Powered
            </span>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-10 mb-8 border border-gray-200/50 hover:shadow-3xl transition-shadow duration-300">
          <div className="mb-6 text-center">
            <p className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">
              Click any topic to begin
            </p>
            <p className="text-xs text-gray-500">
              Instantly generate evidence maps from papers, datasets, and
              research signals
            </p>
          </div>
          <WordCloudComponent
            words={BIOTECH_TERMS}
            onWordClick={handleWordClick}
          />
        </div>

        {isLoading && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-white rounded-2xl p-10 text-center shadow-2xl max-w-md mx-4">
              <div className="relative mb-6">
                <div className="animate-spin rounded-full h-20 w-20 border-4 border-gray-200 mx-auto"></div>
                <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-blue-600 mx-auto absolute top-0 left-1/2 -ml-10"></div>
              </div>
              <p className="text-xl font-bold text-gray-800 mb-2">
                Launching Evidence Mapping
              </p>
              <p className="text-sm text-gray-600">
                Analyzing papers, datasets, and research signals...
              </p>
              <div className="mt-6 flex justify-center gap-1">
                <div
                  className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"
                  style={{ animationDelay: "0ms" }}
                ></div>
                <div
                  className="w-2 h-2 bg-purple-600 rounded-full animate-bounce"
                  style={{ animationDelay: "150ms" }}
                ></div>
                <div
                  className="w-2 h-2 bg-pink-600 rounded-full animate-bounce"
                  style={{ animationDelay: "300ms" }}
                ></div>
              </div>
            </div>
          </div>
        )}

        <div className="text-center">
          <p className="text-sm text-gray-500 mb-4">Powered by</p>
          <div className="flex items-center justify-center gap-6 flex-wrap">
            <span className="text-xs font-semibold text-gray-600 px-4 py-2 bg-white rounded-lg shadow-sm">
              OpenAlex
            </span>
            <span className="text-xs font-semibold text-gray-600 px-4 py-2 bg-white rounded-lg shadow-sm">
              PubMed
            </span>
            <span className="text-xs font-semibold text-gray-600 px-4 py-2 bg-white rounded-lg shadow-sm">
              NCBI GEO
            </span>
            <span className="text-xs font-semibold text-gray-600 px-4 py-2 bg-white rounded-lg shadow-sm">
              Groq AI
            </span>
          </div>
        </div>
      </div>

      {/* Job Management Modal */}
      {showJobManagement && (
        <JobManagement onClose={() => setShowJobManagement(false)} />
      )}
    </main>
  );
}
