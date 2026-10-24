import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Req,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { existsSync, mkdirSync, unlink } from 'fs';
import { diskStorage } from 'multer';
import { PaymentGatewaysService } from './payment-gateways.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { StepUpGuard } from '../auth/guards/step-up.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PERMISSIONS } from '../auth/permissions/permissions';
import { Role } from '@prisma/client';
import { hasValidSignature } from '../common/file-signatures';
import { CreatePaymentGatewayDto, UpdatePaymentGatewayDto } from './dto/payment-gateway.dto';

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/quicktime'];
const UPLOAD_DIR = './uploads/payments';

@ApiTags('Payment Gateways')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('api/admin/payment-gateways')
export class AdminPaymentGatewaysController {
    constructor(private readonly paymentGatewaysService: PaymentGatewaysService) { }

    @ApiOperation({ summary: 'List every payment method, including inactive ones' })
    @Roles(Role.ADMIN)
    @RequirePermissions(PERMISSIONS.PAYMENTS_SETTINGS)
    @Get('all')
    async getAllGateways() {
        return this.paymentGatewaysService.getAllGateways();
    }

    @ApiOperation({ summary: 'Upload a screenshot or walkthrough video for a payment method' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
    @ApiResponse({ status: 201, description: 'Public URL of the uploaded guide media.' })
    @Roles(Role.ADMIN)
    @RequirePermissions(PERMISSIONS.PAYMENTS_SETTINGS)
    @Post('media')
    @UseInterceptors(FileInterceptor('file', {
        storage: diskStorage({
            destination: (req, file, cb) => {
                if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
                cb(null, UPLOAD_DIR);
            },
            filename: (req, file, cb) => {
                const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
                const mimeToExt: Record<string, string> = {
                    'image/jpeg': '.jpg',
                    'image/png': '.png',
                    'image/webp': '.webp',
                    'image/gif': '.gif',
                    'video/mp4': '.mp4',
                    'video/webm': '.webm',
                    'video/quicktime': '.mov',
                };
                // Extension comes from the validated MIME type, never the client filename.
                cb(null, `gateway-${unique}${mimeToExt[file.mimetype] || '.bin'}`);
            },
        }),
        fileFilter: (req, file, cb) => {
            const allowed = ALLOWED_IMAGE_MIMES.includes(file.mimetype) || ALLOWED_VIDEO_MIMES.includes(file.mimetype);
            if (allowed) cb(null, true);
            else cb(new BadRequestException('Only JPEG, PNG, WEBP, GIF images and MP4/WEBM/MOV videos are allowed.'), false);
        },
        limits: { fileSize: 100 * 1024 * 1024, files: 1, fields: 10, fieldSize: 1 * 1024 * 1024, parts: 20 },
    }))
    async uploadGuideMedia(@UploadedFile() file: any, @Req() req: any) {
        if (!file) throw new BadRequestException('File is required.');

        if (!hasValidSignature(file.path, file.mimetype)) {
            unlink(file.path, () => { });
            throw new BadRequestException('File content does not match its declared type.');
        }

        const isVideo = ALLOWED_VIDEO_MIMES.includes(file.mimetype);
        return {
            url: `${UPLOAD_DIR.replace('./', '')}/${file.filename}`,
            kind: isVideo ? 'video' : 'image',
            size: file.size,
            mimetype: file.mimetype,
        };
    }

    @ApiOperation({ summary: 'Create a payment method' })
    @Roles(Role.ADMIN)
    @RequirePermissions(PERMISSIONS.PAYMENTS_SETTINGS)
    @UseGuards(StepUpGuard)
    @Post()
    async createGateway(@Body() data: CreatePaymentGatewayDto, @Req() req: any) {
        return this.paymentGatewaysService.createGateway(data, req.user?.id || req.user?.userId);
    }

    @ApiOperation({ summary: 'Update a payment method' })
    @Roles(Role.ADMIN)
    @RequirePermissions(PERMISSIONS.PAYMENTS_SETTINGS)
    @UseGuards(StepUpGuard)
    @Patch(':id')
    async updateGateway(@Param('id') id: string, @Body() data: UpdatePaymentGatewayDto, @Req() req: any) {
        return this.paymentGatewaysService.updateGateway(id, data, req.user?.id || req.user?.userId);
    }

    @ApiOperation({ summary: 'Delete a payment method' })
    @Roles(Role.ADMIN)
    @RequirePermissions(PERMISSIONS.PAYMENTS_SETTINGS)
    @UseGuards(StepUpGuard)
    @Delete(':id')
    async deleteGateway(@Param('id') id: string, @Req() req: any) {
        return this.paymentGatewaysService.deleteGateway(id, req.user?.id || req.user?.userId);
    }
}
