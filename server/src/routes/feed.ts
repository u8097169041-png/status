import { Router } from 'express';
import type { AppContext } from '../context';
import {
  addComment,
  createPost,
  deleteComment,
  deletePost,
  getPostDetail,
  listPosts,
  repost,
  setBookmark,
  setLike,
  trendingTags,
  undoRepost,
  updatePost,
} from '../services/posts';
import { createStory, deleteStory, listStories, markStorySeen } from '../services/stories';
import { param, q } from './helpers';

export function feedRoutes(ctx: AppContext): Router {
  const r = Router();

  r.get('/posts', (req, res) => {
    res.json(
      listPosts(ctx, {
        worldId: q(req, 'world'),
        characterId: q(req, 'character'),
        tag: q(req, 'tag', 40),
        author: q(req, 'author') === 'user' ? 'user' : undefined,
        bookmarked: q(req, 'bookmarked') === '1',
        cursor: q(req, 'cursor', 120),
        limit: Number(q(req, 'limit') ?? 20) || 20,
      }),
    );
  });
  r.post('/posts', (req, res) => {
    res.status(201).json(createPost(ctx, req.body));
  });
  r.get('/posts/:id', (req, res) => {
    res.json(getPostDetail(ctx, param(req, 'id')));
  });
  r.patch('/posts/:id', (req, res) => {
    res.json(updatePost(ctx, param(req, 'id'), req.body));
  });
  r.delete('/posts/:id', (req, res) => {
    deletePost(ctx, param(req, 'id'));
    res.status(204).end();
  });
  r.put('/posts/:id/like', (req, res) => {
    res.json(setLike(ctx, param(req, 'id'), true));
  });
  r.delete('/posts/:id/like', (req, res) => {
    res.json(setLike(ctx, param(req, 'id'), false));
  });
  r.put('/posts/:id/bookmark', (req, res) => {
    res.json(setBookmark(ctx, param(req, 'id'), true));
  });
  r.delete('/posts/:id/bookmark', (req, res) => {
    res.json(setBookmark(ctx, param(req, 'id'), false));
  });
  r.post('/posts/:id/repost', (req, res) => {
    res.status(201).json(repost(ctx, param(req, 'id'), req.body));
  });
  r.delete('/posts/:id/repost', (req, res) => {
    undoRepost(ctx, param(req, 'id'));
    res.status(204).end();
  });
  r.post('/posts/:id/comments', (req, res) => {
    res.status(201).json(addComment(ctx, param(req, 'id'), req.body));
  });
  r.delete('/comments/:id', (req, res) => {
    deleteComment(ctx, param(req, 'id'));
    res.status(204).end();
  });

  r.get('/tags/trending', (_req, res) => {
    res.json(trendingTags(ctx, 15));
  });

  r.get('/stories', (_req, res) => {
    res.json(listStories(ctx));
  });
  r.post('/stories', (req, res) => {
    res.status(201).json(createStory(ctx, req.body));
  });
  r.post('/stories/:id/view', (req, res) => {
    markStorySeen(ctx, param(req, 'id'));
    res.json({ ok: true });
  });
  r.delete('/stories/:id', (req, res) => {
    deleteStory(ctx, param(req, 'id'));
    res.status(204).end();
  });

  return r;
}
