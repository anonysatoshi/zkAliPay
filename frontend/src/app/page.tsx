'use client';

import { OrderList } from '@/components/orders/OrderList';
import { motion } from 'framer-motion';
import { ArrowRight, Shield, Zap, Globe, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section - Apple Style */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-950 dark:to-purple-950">
        <div className="container mx-auto px-4 py-20 md:py-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-center max-w-5xl mx-auto"
          >
            {/* Main Headline */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-6"
            >
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 leading-tight">
                Buy Crypto with Alipay
              </h1>
            </motion.div>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8 leading-relaxed"
            >
              The world's first <span className="font-semibold text-gray-900 dark:text-white">decentralized crypto exchange</span><br />
              powered by <span className="font-semibold text-gray-900 dark:text-white">zero-knowledge virtual machine</span>
            </motion.p>

            {/* Tagline */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="text-lg text-gray-500 dark:text-gray-400 mb-12 max-w-3xl mx-auto"
            >
              Trade CNY for crypto tokens instantly. No middlemen. No custodians. Just you, the blockchain, and math.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <Button
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 dark:from-blue-500 dark:to-purple-500 dark:hover:from-blue-600 dark:hover:to-purple-600 text-white px-8 py-6 text-lg rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
                onClick={() => {
                  document.getElementById('order-list')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Start Trading
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="px-8 py-6 text-lg rounded-full border-2 hover:bg-gray-50 dark:hover:bg-gray-800 dark:border-gray-700 transition-all duration-300"
                onClick={() => {
                  document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                How It Works
              </Button>
            </motion.div>
          </motion.div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200 dark:bg-blue-900 rounded-full mix-blend-multiply dark:mix-blend-lighten filter blur-3xl opacity-20 dark:opacity-10 animate-blob"></div>
          <div className="absolute top-40 right-10 w-72 h-72 bg-purple-200 dark:bg-purple-900 rounded-full mix-blend-multiply dark:mix-blend-lighten filter blur-3xl opacity-20 dark:opacity-10 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-pink-200 dark:bg-pink-900 rounded-full mix-blend-multiply dark:mix-blend-lighten filter blur-3xl opacity-20 dark:opacity-10 animate-blob animation-delay-4000"></div>
        </div>
      </section>

      {/* Features Section */}
      <section id="how-it-works" className="py-20 bg-white dark:bg-gray-950">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4 dark:text-white">
              Trustless. Private. <span className="text-blue-600 dark:text-blue-400">Unstoppable.</span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Built on cutting-edge cryptography that makes traditional exchanges obsolete
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {/* Feature 1 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="group"
            >
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 p-8 rounded-3xl hover:shadow-xl dark:shadow-blue-900/30 transition-all duration-300 hover:-translate-y-2 border border-transparent dark:border-blue-800">
                <div className="w-14 h-14 bg-blue-600 dark:bg-blue-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Shield className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3 dark:text-white">Zero-Knowledge Proofs</h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  Verify payments without revealing sensitive information. Privacy by design.
                </p>
              </div>
            </motion.div>

            {/* Feature 2 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="group"
            >
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 p-8 rounded-3xl hover:shadow-xl dark:shadow-purple-900/30 transition-all duration-300 hover:-translate-y-2 border border-transparent dark:border-purple-800">
                <div className="w-14 h-14 bg-purple-600 dark:bg-purple-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Zap className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3 dark:text-white">Instant Settlement</h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  Smart contracts release funds automatically when proof is verified. No delays.
                </p>
              </div>
            </motion.div>

            {/* Feature 3 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="group"
            >
              <div className="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-950 dark:to-pink-900 p-8 rounded-3xl hover:shadow-xl dark:shadow-pink-900/30 transition-all duration-300 hover:-translate-y-2 border border-transparent dark:border-pink-800">
                <div className="w-14 h-14 bg-pink-600 dark:bg-pink-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Globe className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3 dark:text-white">Truly Decentralized</h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  No central authority. No KYC. Trade peer-to-peer with anyone, anywhere.
                </p>
              </div>
            </motion.div>

            {/* Feature 4 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="group"
            >
              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900 p-8 rounded-3xl hover:shadow-xl dark:shadow-indigo-900/30 transition-all duration-300 hover:-translate-y-2 border border-transparent dark:border-indigo-800">
                <div className="w-14 h-14 bg-indigo-600 dark:bg-indigo-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Lock className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3 dark:text-white">Self-Custodial</h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  Your keys, your crypto. Funds never leave your wallet until trade completes.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4 dark:text-white">
              Simple. Elegant. <span className="text-purple-600 dark:text-purple-400">Revolutionary.</span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Three steps to trade with cryptographic certainty
            </p>
          </motion.div>

          <div className="max-w-4xl mx-auto space-y-12">
            {/* Step 1 */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8 }}
              className="flex flex-col md:flex-row items-center gap-8"
            >
              <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 dark:from-blue-500 dark:to-purple-500 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                1
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-2xl font-bold mb-2 dark:text-white">Find or Create an Order</h3>
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                  Browse available sell orders or create your own buy order. Set your rate and amount.
                </p>
              </div>
            </motion.div>

            {/* Step 2 */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8 }}
              className="flex flex-col md:flex-row-reverse items-center gap-8"
            >
              <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 dark:from-purple-500 dark:to-pink-500 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                2
              </div>
              <div className="flex-1 text-center md:text-right">
                <h3 className="text-2xl font-bold mb-2 dark:text-white">Pay with Alipay</h3>
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                  Transfer CNY via Alipay with a unique payment note. Upload your PDF receipt.
                </p>
              </div>
            </motion.div>

            {/* Step 3 */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8 }}
              className="flex flex-col md:flex-row items-center gap-8"
            >
              <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-pink-600 to-red-600 dark:from-pink-500 dark:to-red-500 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                3
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-2xl font-bold mb-2 dark:text-white">Receive Crypto Instantly</h3>
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                  Zero-knowledge proof is generated and verified. Tokens are released to your wallet automatically.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Order List Section */}
      <section id="order-list" className="py-20 bg-white dark:bg-gray-950">
        <div className="container mx-auto px-4 max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4 dark:text-white">
              Available <span className="text-blue-600 dark:text-blue-400">Orders</span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Start trading now with live peer-to-peer orders
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <OrderList />
          </motion.div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-20 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 dark:from-blue-900 dark:via-purple-900 dark:to-pink-900 text-white">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Ready to trade without borders?
            </h2>
            <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
              Join the future of decentralized finance. No registration required.
            </p>
            <Button
              size="lg"
              className="bg-white text-purple-600 hover:bg-gray-100 dark:bg-gray-900 dark:text-purple-400 dark:hover:bg-gray-800 px-8 py-6 text-lg rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
              onClick={() => {
                document.getElementById('order-list')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Start Trading Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Add custom CSS for animations */}
      <style jsx global>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}
