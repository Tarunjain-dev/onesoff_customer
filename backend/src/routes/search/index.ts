import { Router } from 'express';
import { SearchController } from '../../controllers/SearchController';

const router = Router();

router.get('/', SearchController.getSuggestions);

export default router;
