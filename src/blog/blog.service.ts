import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 120);
}

@Injectable()
export class BlogService {
  constructor(private prisma: PrismaService) {}

  private async uniqueSlug(base: string): Promise<string> {
    let slug = slugify(base || 'post') || 'post';
    while (await this.prisma.blogPost.findUnique({ where: { slug } })) {
      slug = `${slugify(base || 'post').slice(0, 90)}-${Math.random().toString(36).slice(2, 7)}`;
    }
    return slug;
  }

  async create(data: any, authorId: string) {
    if (!data.titleAr || !data.titleEn || !data.contentAr || !data.contentEn) {
      throw new BadRequestException('titleAr, titleEn, contentAr and contentEn are required');
    }
    const slug = await this.uniqueSlug(data.slug || data.titleEn);
    return this.prisma.blogPost.create({
      data: {
        slug,
        titleAr: data.titleAr,
        titleEn: data.titleEn,
        excerptAr: data.excerptAr,
        excerptEn: data.excerptEn,
        contentAr: data.contentAr,
        contentEn: data.contentEn,
        coverImageUrl: data.coverImageUrl,
        isPublished: false,
        authorId,
      },
      include: { author: { select: { id: true, email: true } } },
    });
  }

  async update(id: string, data: any) {
    const post = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');
    const { slug: slugInput, ...rest } = data;
    return this.prisma.blogPost.update({
      where: { id },
      data: {
        ...rest,
        ...(slugInput ? { slug: await this.uniqueSlug(slugInput) } : {}),
      },
      include: { author: { select: { id: true, email: true } } },
    });
  }

  async remove(id: string) {
    await this.prisma.blogPost.delete({ where: { id } });
    return { ok: true };
  }

  async setPublished(id: string, isPublished: boolean) {
    const post = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');
    return this.prisma.blogPost.update({
      where: { id },
      data: { isPublished, publishedAt: isPublished ? post.publishedAt ?? new Date() : null },
    });
  }

  async list(page = 1, pageSize = 12) {
    const skip = Math.max(0, (page - 1) * pageSize);
    const where = { isPublished: true };
    const [total, items] = await Promise.all([
      this.prisma.blogPost.count({ where }),
      this.prisma.blogPost.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          slug: true,
          titleAr: true,
          titleEn: true,
          excerptAr: true,
          excerptEn: true,
          coverImageUrl: true,
          publishedAt: true,
          author: { select: { id: true, email: true } },
        },
      }),
    ]);
    return { total, page, pageSize, items };
  }

  async listAllAdmin() {
    return this.prisma.blogPost.findMany({
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { id: true, email: true } } },
    });
  }

  async getBySlug(slug: string, includeUnpublished: boolean) {
    const post = await this.prisma.blogPost.findUnique({
      where: { slug },
      include: { author: { select: { id: true, email: true } } },
    });
    if (!post) throw new NotFoundException('Post not found');
    if (!post.isPublished && !includeUnpublished) throw new NotFoundException('Post not found');
    return post;
  }
}