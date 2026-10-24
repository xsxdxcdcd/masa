import { Controller, Get } from '@nestjs/common';
import { AnnouncementBoardService } from './announcement-board.service';

@Controller()
export class AnnouncementBoardController {
    constructor(private readonly service: AnnouncementBoardService) {}

    // Public endpoint — no auth required
    @Get('announcement-board/active')
    getActive() {
        return this.service.findActive();
    }
}
