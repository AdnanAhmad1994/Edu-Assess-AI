import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Rocket, 
  ShieldCheck, 
  BarChart3, 
  BrainCircuit, 
  ArrowRight,
  GraduationCap,
  Sparkles
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.6 }
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2
    }
  }
};

const floatAnimation = {
  animate: {
    y: [0, -15, 0],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background selection:bg-primary/20">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 gradient-primary rounded-lg text-white">
            <GraduationCap className="h-6 w-6" />
          </div>
          <span className="text-xl font-bold tracking-tight">
            Edu<span className="text-primary">Assess</span> AI
          </span>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link href="/login">
            <Button variant="ghost">Login</Button>
          </Link>
          <Link href="/register">
            <Button className="gradient-primary text-white shadow-lg shadow-primary/20">
              Get Started
            </Button>
          </Link>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="relative pt-32 pb-20 px-6 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-primary/5 blur-[120px] rounded-full -z-10" />
          
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1 text-center lg:text-left space-y-8">
              <motion.div
                initial="hidden"
                animate="visible"
                variants={fadeIn}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium"
              >
                <Sparkles className="h-4 w-4" />
                Next-Gen AI Assessment Platform
              </motion.div>
              
              <motion.h1 
                initial="hidden"
                animate="visible"
                variants={{
                  ...fadeIn,
                  visible: { ...fadeIn.visible, transition: { delay: 0.1 } }
                }}
                className="text-5xl lg:text-7xl font-extrabold tracking-tight leading-tight"
              >
                Revolutionize Learning with <span className="text-gradient">AI-Powered</span> Assessments
              </motion.h1>
              
              <motion.p
                initial="hidden"
                animate="visible"
                variants={{
                  ...fadeIn,
                  visible: { ...fadeIn.visible, transition: { delay: 0.2 } }
                }}
                className="text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0"
              >
                Streamline your teaching workflow with instant quiz generation, 
                smart proctoring, and deep performance analytics. Built for the modern classroom.
              </motion.p>
              
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                  ...fadeIn,
                  visible: { ...fadeIn.visible, transition: { delay: 0.3 } }
                }}
                className="flex flex-wrap justify-center lg:justify-start gap-4"
              >
                <Link href="/register">
                  <Button size="lg" className="h-12 px-8 gradient-primary text-white shadow-xl shadow-primary/25 text-lg">
                    Join for Free <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="h-12 px-8 text-lg border-primary/20 hover:bg-primary/5">
                    View Demo
                  </Button>
                </Link>
              </motion.div>

              <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                  ...fadeIn,
                  visible: { ...fadeIn.visible, transition: { delay: 0.4 } }
                }}
                className="flex items-center justify-center lg:justify-start gap-8 pt-4 text-muted-foreground"
              >
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">500+</div>
                  <div className="text-xs uppercase tracking-wider">Courses</div>
                </div>
                <div className="w-px h-8 bg-border" />
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">10k+</div>
                  <div className="text-xs uppercase tracking-wider">Student Active</div>
                </div>
                <div className="w-px h-8 bg-border" />
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">99%</div>
                  <div className="text-xs uppercase tracking-wider">Accuracy</div>
                </div>
              </motion.div>
            </div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.8, rotate: -2 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="flex-1 relative"
            >
              <div className="relative z-10 rounded-2xl border bg-card shadow-2xl p-2 overflow-hidden overflow-x-auto">
                 <div className="rounded-xl border bg-background/50 overflow-hidden min-w-[500px]">
                    {/* Mock Dashboard UI */}
                    <div className="p-4 border-b flex items-center justify-between bg-card">
                      <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-destructive/50" />
                        <div className="w-3 h-3 rounded-full bg-warning/50" />
                        <div className="w-3 h-3 rounded-full bg-success/50" />
                      </div>
                      <div className="text-xs font-medium text-muted-foreground">Admin Analytics Dashboard</div>
                      <div className="w-12" />
                    </div>
                    <div className="p-6 grid grid-cols-2 gap-4">
                      <div className="space-y-4">
                        <div className="h-32 rounded-lg bg-primary/5 border border-primary/10 p-4 relative overflow-hidden">
                           <div className="text-xs font-semibold text-primary">Active Enrollments</div>
                           <div className="text-2xl font-bold mt-1">1,284</div>
                           <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-primary/10 rounded-full blur-xl" />
                        </div>
                        <div className="h-32 rounded-lg bg-accent/5 border border-accent/10 p-4 relative overflow-hidden">
                           <div className="text-xs font-semibold text-accent">Average Score</div>
                           <div className="text-2xl font-bold mt-1">84.2%</div>
                           <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-accent/10 rounded-full blur-xl" />
                        </div>
                      </div>
                      <div className="rounded-lg bg-card border p-4 space-y-3">
                         <div className="text-xs font-semibold">Quiz Completion Rates</div>
                         {[80, 45, 90, 60].map((w, i) => (
                           <div key={i} className="space-y-1">
                             <div className="flex justify-between text-[10px]">
                               <span>Unit {i+1}</span>
                               <span>{w}%</span>
                             </div>
                             <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                               <motion.div 
                                 initial={{ width: 0 }}
                                 animate={{ width: `${w}%` }}
                                 transition={{ duration: 1, delay: 0.8 }}
                                 className="h-full bg-primary" 
                               />
                             </div>
                           </div>
                         ))}
                      </div>
                    </div>
                 </div>
              </div>
              
              {/* Floating elements */}
              <motion.div 
                variants={floatAnimation}
                animate="animate"
                className="absolute -top-10 -right-10 p-4 rounded-xl glass border shadow-xl z-20 hidden lg:block"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-success/20 rounded-lg text-success">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-sm font-bold">Proctoring Active</div>
                    <div className="text-[10px] text-muted-foreground">AI monitoring enabled</div>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                variants={{
                  animate: {
                    ...floatAnimation.animate,
                    y: [0, 15, 0],
                    transition: { ...floatAnimation.animate.transition, delay: 0.5 }
                  }
                }}
                animate="animate"
                className="absolute -bottom-6 -left-10 p-4 rounded-xl glass border shadow-xl z-20 hidden lg:block"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/20 rounded-lg text-primary">
                    <BrainCircuit className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-sm font-bold">AI Quiz Builder</div>
                    <div className="text-[10px] text-muted-foreground">Generate in seconds</div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 px-6 bg-secondary/30">
          <div className="max-w-7xl mx-auto space-y-16">
            <div className="text-center space-y-4">
              <h2 className="text-3xl lg:text-5xl font-bold tracking-tight">Everything You Need To <span className="text-primary">Succeed</span></h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Comprehensive tools designed to make teaching more effective and learning more engaging.
              </p>
            </div>

            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
              className="grid grid-cols-1 md:grid-cols-3 gap-8"
            >
              <FeatureCard 
                icon={<BrainCircuit className="h-8 w-8 text-primary" />}
                title="AI Quiz Generation"
                description="Upload PDFs, paste text, or simply provide a topic. Our AI generates comprehensive quizzes with multiple choice, true/false, and open questions instantly."
              />
              <FeatureCard 
                icon={<ShieldCheck className="h-8 w-8 text-accent" />}
                title="Smart Proctoring"
                description="Our advanced AI-driven proctoring detects suspicious activity, multiple faces, and browser tab switches to ensure academic integrity."
              />
              <FeatureCard 
                icon={<BarChart3 className="h-8 w-8 text-primary" />}
                title="Actionable Analytics"
                description="Get granular insights into student performance. Visualize class progress, identify struggling areas, and celebrate improvements with ease."
              />
            </motion.div>
          </div>
        </section>

        {/* Call to Action Section */}
        <section className="py-24 px-6 relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/10 blur-[150px] rounded-full -z-10" />
          
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto text-center space-y-8 glass p-12 rounded-3xl border shadow-2xl"
          >
            <h2 className="text-4xl lg:text-6xl font-black">Ready to Start Your <span className="text-gradient">AI Journey?</span></h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Join thousands of educators and students who are already using EduAssess AI to transform their educational experience.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-4">
               <Link href="/register">
                 <Button size="lg" className="h-14 px-12 gradient-primary text-white shadow-2xl shadow-primary/30 text-xl font-bold rounded-2xl">
                   Join EduAssess Now
                 </Button>
               </Link>
            </div>
            <p className="text-sm text-muted-foreground">Free for personal use. No credit card required.</p>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-12 px-6 border-t font-medium text-sm text-muted-foreground">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8 text-center md:text-left">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-foreground">
              <div className="p-1 gradient-primary rounded text-white">
                <GraduationCap className="h-4 w-4" />
              </div>
              <span className="font-bold">EduAssess AI</span>
            </div>
            <p className="max-w-xs">Enhancing education through artificial intelligence and smart automation.</p>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-12">
            <div className="space-y-3">
              <div className="text-foreground font-bold">Product</div>
              <div className="hover:text-primary transition-colors cursor-pointer">Features</div>
              <div className="hover:text-primary transition-colors cursor-pointer">Pricing</div>
              <div className="hover:text-primary transition-colors cursor-pointer">Support</div>
            </div>
            <div className="space-y-3">
              <div className="text-foreground font-bold">Company</div>
              <div className="hover:text-primary transition-colors cursor-pointer">About</div>
              <div className="hover:text-primary transition-colors cursor-pointer">Contact</div>
              <div className="hover:text-primary transition-colors cursor-pointer">Privacy</div>
            </div>
             <div className="space-y-3">
              <div className="text-foreground font-bold">Connect</div>
              <div className="hover:text-primary transition-colors cursor-pointer">Twitter</div>
              <div className="hover:text-primary transition-colors cursor-pointer">LinkedIn</div>
              <div className="hover:text-primary transition-colors cursor-pointer">GitHub</div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-12 pt-8 border-t text-center">
          © 2026 EduAssess AI. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <motion.div variants={fadeIn}>
      <Card className="h-full hover-elevate-2 transition-all duration-300 border-primary/10 overflow-hidden group">
        <CardContent className="p-8 space-y-6">
          <div className="p-3 bg-primary/5 w-fit rounded-2xl group-hover:scale-110 group-hover:bg-primary/10 transition-transform">
            {icon}
          </div>
          <div className="space-y-3">
            <h3 className="text-2xl font-bold">{title}</h3>
            <p className="text-muted-foreground leading-relaxed">
              {description}
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
