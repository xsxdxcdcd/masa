import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BlogService } from './blog.service';

@ApiTags('Blog')
@ApiBearerAuth('JWT-auth')
@Controller('blog')
export class BlogController {
  constructor(private blog: BlogService) {}

  @ApiOperation({ summary: 'Public list of published posts (page, pageSize)' })
  @Get()
  list(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.blog.list(page ? parseInt(page, 10) : 1, pageSize ? Math.min(50, parseInt(pageSize, 10)) : 12);
  }

  @ApiOperation({ summary: 'Get a post by slug (?includeUnpublished=true for staff prev/rew)' })
  @Get(':slug')
  getBySlug(@Param('slug') slug: string, @Query('includeUnpublished') includeUnpublished?: string) {
    return this.blog.getBySlug(slug, includeUnpublished === 'true');
  }
}
