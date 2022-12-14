import * as trpc from '@trpc/server'
import { cloudinary } from '../../services/cloudinary'
import { Post } from '../../types/app.types'
import { createRouter } from '../createRouter'
import {
  AddCommentSchema,
  DeleteCommentSchema,
  DeletePostSchema,
  GetPostSchema,
  LikePostSchema,
  PostSchema,
} from '../schemas/post.schema'

export const postRouter = createRouter()
  .query('get-post', {
    input: GetPostSchema,
    resolve: async ({ ctx, input }) => {
      const { postId } = input

      const post = await ctx.prisma.post.findUnique({
        where: {
          id: postId,
        },

        include: {
          likedUsers: { select: { id: true, name: true, avatar: true } },
          User: {
            select: {
              name: true,
              avatar: true,
              id: true,
            },
          },
          comments: {
            include: {
              User: {
                select: {
                  name: true,
                  avatar: true,
                  id: true,
                },
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      })

      if (!post) {
        throw new trpc.TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Post not found',
        })
      }

      return { post: JSON.parse(JSON.stringify(post)) as Post }
    },
  })
  .mutation('create-post', {
    input: PostSchema,

    resolve: async ({ ctx, input }) => {
      const { caption, images } = input

      if (!ctx.session) {
        throw new trpc.TRPCError({
          code: 'FORBIDDEN',
          message: 'You must be logged in to create a post',
        })
      }

      let urls = []

      // upload files to cloudindary and get their urls
      for (const file of images) {
        const path = await cloudinary.uploader.upload(file, { upload_preset: 'react-upload' })
        urls.push(path.secure_url)
      }

      // create post in a db with urls of files
      const post = await ctx.prisma.post.create({
        data: {
          images: urls,
          userId: ctx.session?.user.id,
        },
      })

      // if caption exists, create comment with it
      if (caption) {
        await ctx.prisma.comments.create({
          data: {
            postId: post.id,
            userId: ctx.session.user.id,
            body: caption!,
          },
        })
      }

      if (!post) {
        throw new trpc.TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Something went wrong',
        })
      }

      return {
        status: 'ok',
      }
    },
  })
  .mutation('delete-post', {
    input: DeletePostSchema,

    resolve: async ({ ctx, input }) => {
      const { id } = input

      if (!ctx.session) {
        throw new trpc.TRPCError({
          code: 'FORBIDDEN',
          message: 'You must be logged in to create a post',
        })
      }

      const delPost = ctx.prisma.post.delete({
        where: {
          id,
        },
      })

      const delCommentsFromPost = ctx.prisma.comments.deleteMany({
        where: {
          postId: id,
        },
      })

      const transaction = await ctx.prisma.$transaction([delCommentsFromPost, delPost])

      // get ids of images in format '/folder/id.jpg'
      const cloudinaryIds = transaction[1].images.map((image) => image.split('/').splice(-2, 2).join('/').slice(0, -4))

      // del images from cloudinary
      await cloudinary.api.delete_resources(cloudinaryIds as string[])

      return {
        status: 'ok',
      }
    },
  })
  .mutation('like-post', {
    input: LikePostSchema,

    resolve: async ({ ctx, input }) => {
      const { postId } = input

      if (!ctx.session) {
        throw new trpc.TRPCError({
          code: 'FORBIDDEN',
          message: 'You must be logged in.',
        })
      }

      // like post
      await ctx.prisma.post.update({
        where: {
          id: postId,
        },
        data: {
          likedUsers: {
            connect: {
              id: ctx.session.user.id,
            },
          },
        },
      })
    },
  })
  .mutation('unlike-post', {
    input: LikePostSchema,

    resolve: async ({ ctx, input }) => {
      const { postId } = input

      if (!ctx.session) {
        throw new trpc.TRPCError({
          code: 'FORBIDDEN',
          message: 'You must be logged in.',
        })
      }

      // unlike post
      await ctx.prisma.post.update({
        where: {
          id: postId,
        },
        data: {
          likedUsers: {
            disconnect: {
              id: ctx.session.user.id,
            },
          },
        },
      })
    },
  })
  .mutation('add-comment', {
    input: AddCommentSchema,

    resolve: async ({ ctx, input }) => {
      const { postId, comment } = input

      if (!ctx.session) {
        throw new trpc.TRPCError({
          code: 'FORBIDDEN',
          message: 'You must be logged in to comment.',
        })
      }

      const commentAdded = await ctx.prisma.comments.create({
        data: {
          postId,
          userId: ctx.session.user.id,
          body: comment,
        },
        include: {
          User: {
            select: {
              name: true,
              avatar: true,
              id: true,
            },
          },
        },
      })

      return {
        status: 'ok',
        commentAdded,
      }
    },
  })
  .mutation('delete-comment', {
    input: DeleteCommentSchema,

    resolve: async ({ ctx, input }) => {
      const { commentId } = input

      if (!commentId) {
        throw new trpc.TRPCError({
          code: 'BAD_REQUEST',
        })
      }

      // delete comment
      await ctx.prisma.comments.delete({
        where: {
          id: commentId,
        },
      })

      return { status: 'ok' }
    },
  })
