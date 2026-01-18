"use client";

import { useState } from "react";
import Link from "next/link";

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">(
    "monthly",
  );

  const plans = [
    {
      name: "Free",
      description: "Perfect for exploring and trying out the platform",
      monthlyPrice: 0,
      annualPrice: 0,
      features: [
        "3 evidence maps per month",
        "Maximum 3 layers in knowledge tree",
        "Basic notebook features",
        "50 sources per job",
        "Community support",
        "Export to Markdown",
      ],
      limitations: ["Limited to 3 maps/month", "No priority processing"],
      cta: "Get Started Free",
      popular: false,
      color: "from-gray-600 to-gray-700",
    },
    {
      name: "Pro",
      description: "For researchers and professionals",
      monthlyPrice: 29,
      annualPrice: 290,
      features: [
        "Unlimited evidence maps",
        "Maximum 5 layers in knowledge tree",
        "Advanced notebook with AI copilot",
        "200 sources per job",
        "Priority processing",
        "Export to PDF & Markdown",
        "Email support",
        "Custom topic suggestions",
        "Collaboration features",
      ],
      limitations: [],
      cta: "Start Pro Trial",
      popular: true,
      color: "from-blue-600 to-purple-600",
    },
    {
      name: "Enterprise",
      description: "For teams and organizations",
      monthlyPrice: 99,
      annualPrice: 990,
      features: [
        "Everything in Pro",
        "Unlimited layers in knowledge tree",
        "500+ sources per job",
        "Dedicated worker instances",
        "Custom LLM integration",
        "API access",
        "SSO & advanced security",
        "Priority support & onboarding",
        "Custom integrations",
        "Team collaboration tools",
        "Usage analytics dashboard",
      ],
      limitations: [],
      cta: "Contact Sales",
      popular: false,
      color: "from-purple-600 to-pink-600",
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Header */}
      <div className="container mx-auto px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
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
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Home
        </Link>
      </div>

      {/* Pricing Header */}
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
          Choose Your Plan
        </h1>
        <p className="text-xl text-gray-700 mb-8 max-w-2xl mx-auto">
          Start mapping evidence for free, upgrade as you grow
        </p>

        {/* Billing Toggle */}
        <div className="inline-flex items-center gap-4 bg-white rounded-full p-2 shadow-lg">
          <button
            onClick={() => setBillingCycle("monthly")}
            className={`px-6 py-2 rounded-full font-medium transition-all ${
              billingCycle === "monthly"
                ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle("annual")}
            className={`px-6 py-2 rounded-full font-medium transition-all ${
              billingCycle === "annual"
                ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Annual
            <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
              Save 17%
            </span>
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="container mx-auto px-4 pb-16">
        <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`bg-white rounded-2xl shadow-xl p-8 relative ${
                plan.popular ? "ring-4 ring-purple-500 scale-105" : ""
              } hover:shadow-2xl transition-all`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                  Most Popular
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {plan.name}
                </h3>
                <p className="text-gray-600 text-sm mb-4">{plan.description}</p>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-5xl font-bold text-gray-900">
                    $
                    {billingCycle === "monthly"
                      ? plan.monthlyPrice
                      : Math.floor(plan.annualPrice / 12)}
                  </span>
                  <span className="text-gray-600">/month</span>
                </div>
                {billingCycle === "annual" && plan.annualPrice > 0 && (
                  <p className="text-sm text-gray-500 mt-2">
                    Billed ${plan.annualPrice} annually
                  </p>
                )}
              </div>

              <button
                className={`w-full py-3 rounded-lg font-semibold mb-6 transition-all bg-gradient-to-r ${plan.color} text-white hover:shadow-lg hover:scale-105`}
              >
                {plan.cta}
              </button>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-900 mb-3">
                  What's included:
                </p>
                {plan.features.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-gray-700 text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Can I change plans later?
              </h3>
              <p className="text-gray-600">
                Yes! You can upgrade or downgrade your plan at any time. Changes
                take effect immediately.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                What payment methods do you accept?
              </h3>
              <p className="text-gray-600">
                We accept all major credit cards, PayPal, and can arrange
                invoicing for Enterprise customers.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Is there a free trial for Pro?
              </h3>
              <p className="text-gray-600">
                Yes! Pro plan comes with a 14-day free trial. No credit card
                required.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                What happens to my data if I cancel?
              </h3>
              <p className="text-gray-600">
                Your data remains accessible for 30 days after cancellation. You
                can export everything before it's deleted.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
