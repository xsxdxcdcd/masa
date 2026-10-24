import { PartialType } from '@nestjs/swagger';
import { CreateAnnouncementBoardDto } from './create-announcement-board.dto';

export class UpdateAnnouncementBoardDto extends PartialType(CreateAnnouncementBoardDto) {}
