import type { Metadata } from 'next';
import BlogList from './BlogList.client';

export const metadata: Metadata = {
    title: 'Blog | Laxalab',
    description: 'Insights, news and updates from Laxalab.',
};

export default function BlogPage() {
    return <BlogList />;
}