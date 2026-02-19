-- Create site_pages table for CMS-managed public pages
CREATE TABLE public.site_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  meta_description TEXT,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_published BOOLEAN NOT NULL DEFAULT false,
  category TEXT NOT NULL CHECK (category IN ('product', 'company', 'resources', 'legal')),
  icon TEXT DEFAULT 'file-text',
  position INTEGER NOT NULL DEFAULT 0,
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster slug lookups
CREATE INDEX idx_site_pages_slug ON public.site_pages(slug);
CREATE INDEX idx_site_pages_category ON public.site_pages(category);

-- Enable Row Level Security
ALTER TABLE public.site_pages ENABLE ROW LEVEL SECURITY;

-- Public can read published pages
CREATE POLICY "Anyone can view published pages"
ON public.site_pages
FOR SELECT
USING (is_published = true);

-- Super admins can view all pages (including drafts)
CREATE POLICY "Super admins can view all pages"
ON public.site_pages
FOR SELECT
USING (is_super_admin(auth.uid()));

-- Super admins can create pages
CREATE POLICY "Super admins can create pages"
ON public.site_pages
FOR INSERT
WITH CHECK (is_super_admin(auth.uid()));

-- Super admins can update pages
CREATE POLICY "Super admins can update pages"
ON public.site_pages
FOR UPDATE
USING (is_super_admin(auth.uid()));

-- Super admins can delete pages
CREATE POLICY "Super admins can delete pages"
ON public.site_pages
FOR DELETE
USING (is_super_admin(auth.uid()));

-- Create trigger to update updated_at
CREATE TRIGGER update_site_pages_updated_at
BEFORE UPDATE ON public.site_pages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial pages with default content
INSERT INTO public.site_pages (slug, title, meta_description, category, icon, position, is_published, content) VALUES
-- Product pages
('features', 'Features', 'Discover all the powerful features of Hamro Task', 'product', 'sparkles', 0, true, '{"hero":{"title":"Powerful Features","subtitle":"Everything you need to manage projects efficiently"},"sections":[{"type":"features_grid","items":[{"icon":"layout-dashboard","title":"Intuitive Dashboard","description":"Get a bird''s eye view of all your projects and tasks"},{"icon":"users","title":"Team Collaboration","description":"Work together seamlessly with your team members"},{"icon":"kanban","title":"Kanban Boards","description":"Visualize your workflow with drag-and-drop boards"},{"icon":"bell","title":"Smart Notifications","description":"Stay updated with real-time notifications"},{"icon":"timer","title":"Time Tracking","description":"Track time spent on tasks automatically"},{"icon":"shield","title":"Role-Based Access","description":"Control who can see and edit your projects"}]},{"type":"cta","title":"Ready to boost your productivity?","button_text":"Get Started Free","button_link":"/auth"}]}'::jsonb),
('pricing', 'Pricing', 'Simple and transparent pricing for teams of all sizes', 'product', 'credit-card', 1, true, '{"hero":{"title":"Simple Pricing","subtitle":"Choose the plan that fits your team"},"sections":[{"type":"text","content":"Our pricing is designed to be simple and transparent. No hidden fees, no surprises."},{"type":"cta","title":"Start your free trial today","button_text":"Get Started","button_link":"/auth"}]}'::jsonb),
('integrations', 'Integrations', 'Connect Hamro Task with your favorite tools', 'product', 'plug', 2, true, '{"hero":{"title":"Integrations","subtitle":"Connect with the tools you already use"},"sections":[{"type":"text","content":"Hamro Task integrates seamlessly with popular tools to streamline your workflow. More integrations coming soon!"},{"type":"cta","title":"Need a specific integration?","button_text":"Contact Us","button_link":"/contact"}]}'::jsonb),
('changelog', 'Changelog', 'See what''s new in Hamro Task', 'product', 'git-branch', 3, true, '{"hero":{"title":"Changelog","subtitle":"Stay updated with the latest improvements"},"sections":[{"type":"text","content":"## February 2026\n\n### New Features\n- Enhanced mobile experience\n- Custom project templates\n- Team chat integration\n\n### Improvements\n- Faster page load times\n- Better notification system\n- Improved search functionality"}]}'::jsonb),

-- Company pages
('about', 'About Us', 'Learn about Hamro Task and our mission', 'company', 'building-2', 0, true, '{"hero":{"title":"About Hamro Task","subtitle":"Built for Nepali teams, loved worldwide"},"sections":[{"type":"text","content":"Hamro Task was born from a simple idea: project management should be simple, beautiful, and accessible to everyone.\n\nWe are a passionate team based in Kathmandu, Nepal, dedicated to building tools that help teams work better together."},{"type":"features_grid","items":[{"icon":"target","title":"Our Mission","description":"Empower teams to achieve more with less effort"},{"icon":"heart","title":"Our Values","description":"Simplicity, transparency, and user-first design"},{"icon":"globe","title":"Our Reach","description":"Serving teams across Nepal and beyond"}]},{"type":"cta","title":"Join our growing community","button_text":"Get Started","button_link":"/auth"}]}'::jsonb),
('careers', 'Careers', 'Join the Hamro Task team', 'company', 'briefcase', 1, true, '{"hero":{"title":"Join Our Team","subtitle":"Help us build the future of project management"},"sections":[{"type":"text","content":"We are always looking for talented individuals who share our passion for building great products.\n\n## Why Work With Us?\n\n- Remote-first culture\n- Competitive compensation\n- Learning and growth opportunities\n- Work on meaningful projects\n\n## Current Openings\n\nNo open positions at the moment. Check back soon or send your resume to careers@hamrotask.com"},{"type":"cta","title":"Interested in joining?","button_text":"Contact Us","button_link":"/contact"}]}'::jsonb),
('blog', 'Blog', 'Tips, updates, and insights from the Hamro Task team', 'company', 'newspaper', 2, true, '{"hero":{"title":"Blog","subtitle":"Tips, updates, and insights"},"sections":[{"type":"text","content":"## Coming Soon\n\nOur blog is under construction. Stay tuned for productivity tips, product updates, and team collaboration insights.\n\nIn the meantime, follow us on social media for the latest updates."},{"type":"cta","title":"Want to be notified?","button_text":"Get Started","button_link":"/auth"}]}'::jsonb),
('contact', 'Contact', 'Get in touch with the Hamro Task team', 'company', 'mail', 3, true, '{"hero":{"title":"Contact Us","subtitle":"We''d love to hear from you"},"sections":[{"type":"text","content":"Have questions, feedback, or just want to say hello? We''re here to help!\n\n## Get in Touch\n\n📧 **Email:** hello@hamrotask.com\n\n📍 **Location:** Kathmandu, Nepal\n\n📞 **Phone:** +977 1-4XXXXXX\n\n## Office Hours\n\nSunday - Friday: 10:00 AM - 6:00 PM NPT"},{"type":"cta","title":"Ready to get started?","button_text":"Sign Up Free","button_link":"/auth"}]}'::jsonb),

-- Resources pages
('docs', 'Documentation', 'Learn how to use Hamro Task effectively', 'resources', 'book-open', 0, true, '{"hero":{"title":"Documentation","subtitle":"Everything you need to get started"},"sections":[{"type":"text","content":"## Getting Started\n\n1. **Create an account** - Sign up for free\n2. **Create a workspace** - Set up your team space\n3. **Invite members** - Add your teammates\n4. **Create projects** - Organize your work\n5. **Add tasks** - Break down your projects\n\n## Key Concepts\n\n- **Workspaces** - Separate environments for different teams\n- **Projects** - Collections of related tasks\n- **Tasks** - Individual work items\n- **Statuses** - Track progress with custom columns"},{"type":"cta","title":"Need more help?","button_text":"Contact Support","button_link":"/contact"}]}'::jsonb),
('help', 'Help Center', 'Find answers to common questions', 'resources', 'help-circle', 1, true, '{"hero":{"title":"Help Center","subtitle":"Find answers to your questions"},"sections":[{"type":"faq","items":[{"question":"How do I create a new project?","answer":"Navigate to your workspace, click the Projects tab, then click the ''New Project'' button."},{"question":"How do I invite team members?","answer":"Go to your workspace settings, click on Members, and use the Invite button to send invitations."},{"question":"Can I use Hamro Task on mobile?","answer":"Yes! Hamro Task is fully responsive and works great on mobile devices. You can also install it as a PWA."},{"question":"How do I track time on tasks?","answer":"Open any task and click the timer button to start tracking time. Click again to stop."},{"question":"Is my data secure?","answer":"Absolutely. We use industry-standard encryption and security practices to protect your data."}]},{"type":"cta","title":"Still need help?","button_text":"Contact Us","button_link":"/contact"}]}'::jsonb),
('community', 'Community', 'Join the Hamro Task community', 'resources', 'users', 2, true, '{"hero":{"title":"Community","subtitle":"Connect with other Hamro Task users"},"sections":[{"type":"text","content":"Join our growing community of productivity enthusiasts!\n\n## Connect With Us\n\n- **Facebook** - Follow us for updates\n- **Twitter** - Join the conversation\n- **LinkedIn** - Professional networking\n\n## Share Your Story\n\nWe love hearing how teams use Hamro Task. Share your story and get featured!"},{"type":"cta","title":"Ready to join?","button_text":"Get Started","button_link":"/auth"}]}'::jsonb),
('api', 'API Reference', 'Developer documentation for the Hamro Task API', 'resources', 'code', 3, true, '{"hero":{"title":"API Reference","subtitle":"Build integrations with Hamro Task"},"sections":[{"type":"text","content":"## Coming Soon\n\nOur public API is currently in development. We''re building a comprehensive API that will allow you to:\n\n- Create and manage tasks programmatically\n- Sync data with external systems\n- Build custom integrations\n- Automate workflows\n\n## Interested in Early Access?\n\nContact us to join our API beta program."},{"type":"cta","title":"Join the beta","button_text":"Contact Us","button_link":"/contact"}]}'::jsonb),

-- Legal pages
('privacy', 'Privacy Policy', 'How we collect, use, and protect your data', 'legal', 'shield', 0, true, '{"hero":{"title":"Privacy Policy","subtitle":"Last updated: February 2026"},"sections":[{"type":"text","content":"## Introduction\n\nAt Hamro Task, we take your privacy seriously. This policy describes how we collect, use, and protect your personal information.\n\n## Information We Collect\n\n- **Account Information:** Name, email address, and password\n- **Usage Data:** How you interact with our service\n- **Device Information:** Browser type, IP address, and device type\n\n## How We Use Your Information\n\n- To provide and improve our services\n- To communicate with you about your account\n- To send important updates and announcements\n\n## Data Security\n\nWe implement industry-standard security measures to protect your data, including encryption, secure servers, and regular security audits.\n\n## Your Rights\n\n- Access your personal data\n- Request data deletion\n- Opt out of marketing communications\n- Export your data\n\n## Contact Us\n\nFor privacy-related questions, contact us at privacy@hamrotask.com"}]}'::jsonb),
('terms', 'Terms of Service', 'Terms and conditions for using Hamro Task', 'legal', 'file-text', 1, true, '{"hero":{"title":"Terms of Service","subtitle":"Last updated: February 2026"},"sections":[{"type":"text","content":"## Agreement to Terms\n\nBy accessing or using Hamro Task, you agree to be bound by these Terms of Service.\n\n## Use of Service\n\n- You must be at least 16 years old to use our service\n- You are responsible for maintaining the security of your account\n- You agree not to misuse our services\n\n## User Content\n\n- You retain ownership of content you create\n- You grant us license to host and display your content\n- You are responsible for the content you upload\n\n## Service Availability\n\n- We strive for 99.9% uptime\n- We may perform maintenance with advance notice\n- We reserve the right to modify or discontinue features\n\n## Limitation of Liability\n\nHamro Task is provided \"as is\" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages.\n\n## Changes to Terms\n\nWe may update these terms from time to time. Continued use of the service constitutes acceptance of updated terms.\n\n## Contact\n\nFor questions about these terms, contact legal@hamrotask.com"}]}'::jsonb),
('cookies', 'Cookie Policy', 'How we use cookies on Hamro Task', 'legal', 'cookie', 2, true, '{"hero":{"title":"Cookie Policy","subtitle":"Last updated: February 2026"},"sections":[{"type":"text","content":"## What Are Cookies?\n\nCookies are small text files stored on your device when you visit a website. They help us provide a better experience.\n\n## Cookies We Use\n\n### Essential Cookies\nRequired for the website to function properly. These cannot be disabled.\n\n### Analytics Cookies\nHelp us understand how visitors interact with our website.\n\n### Preference Cookies\nRemember your settings and preferences.\n\n## Managing Cookies\n\nYou can control cookies through your browser settings. Note that disabling cookies may affect your experience.\n\n## Third-Party Cookies\n\nWe may use third-party services that set their own cookies:\n- Analytics providers\n- Authentication services\n\n## Updates to This Policy\n\nWe may update this cookie policy periodically. Check back for the latest information.\n\n## Contact\n\nFor questions about our cookie policy, contact privacy@hamrotask.com"}]}'::jsonb);