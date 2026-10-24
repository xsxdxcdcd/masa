import type { Metadata } from 'next';
import ContactContent from './Contact.client';

export const metadata: Metadata = {
    title: 'Contact Us',
    description: 'Get in touch with the Laxalab team — support, inquiries, and feedback.',
};

export default function ContactPage() {
    return <ContactContent />;
}